"""
フォーム検出エンジンサービス
企業のウェブサイトから問い合わせフォームを自動検出
"""
import asyncio
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
import logging

from playwright.async_api import Page, ElementHandle, Locator
from sqlalchemy.orm import Session

from app.services.browser_pool import browser_pool
from app.models.form import Form, FormField
from app.models.company import Company, FormDetectionStatus
from app.schemas.form import FormFieldType
from app.core.compliance import get_compliance_manager, ComplianceCheck

logger = logging.getLogger(__name__)


class FormDetector:
    """フォーム検出エンジンクラス"""
    
    # 問い合わせページを探すためのキーワード
    CONTACT_KEYWORDS = [
        "お問い合わせ", "問い合わせ", "contact", "お客様相談", "お客様窓口",
        "inquiry", "お問合せ", "お問合わせ", "コンタクト", "ご相談",
        "support", "help", "お客様サポート", "サポート"
    ]
    
    # フォームフィールドタイプの判定パターン
    FIELD_TYPE_PATTERNS = {
        FormFieldType.EMAIL: [
            r"email|mail|メール",
            r"type=['\"]?email['\"]?",
        ],
        FormFieldType.TEL: [
            r"tel|phone|電話|でんわ",
            r"type=['\"]?tel['\"]?",
        ],
        FormFieldType.TEXTAREA: [
            r"message|content|内容|メッセージ|詳細|問い合わせ内容",
        ],
    }
    
    def __init__(self, browser_pool_instance=None):
        # テスト時など引数が渡されない場合はグローバルbrowser_poolを使用
        self.browser_pool = browser_pool_instance if browser_pool_instance is not None else browser_pool
        self.compliance_manager = get_compliance_manager()
    
    async def detect_forms(self, url: str, company_id: int, db: Session) -> List[Dict]:
        """企業URLからフォームを検出してデータベースに保存"""
        # 企業のフォーム検出ステータスを"進行中"に更新
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise Exception(f"企業が見つかりません: ID={company_id}")
        
        company.form_detection_status = FormDetectionStatus.IN_PROGRESS
        company.form_detection_error_message = None  # エラーメッセージをクリア
        db.commit()
        
        logger.info(f"フォーム検出開始: 企業ID={company_id}, URL={url}")
        
        try:
            # コンプライアンスチェック
            compliance_check = await self.compliance_manager.check_compliance(url)
            
            if not compliance_check.allowed:
                error_msg = f"コンプライアンス違反: {', '.join(compliance_check.errors)}"
                # エラーステータスに更新
                company.form_detection_status = FormDetectionStatus.ERROR
                company.form_detection_error_message = error_msg
                db.commit()
                raise Exception(error_msg)
            
            # 警告がある場合はログに記録
            if compliance_check.warnings:
                logger.warning(f"コンプライアンス警告 for {url}: {', '.join(compliance_check.warnings)}")
            
            # 推奨遅延を適用
            if compliance_check.delay_seconds > 0:
                logger.info(f"推奨遅延 {compliance_check.delay_seconds}秒を適用: {url}")
                await asyncio.sleep(compliance_check.delay_seconds)
        
        except Exception as e:
            logger.error(f"コンプライアンスチェックエラー {url}: {e}")
            # エラーステータスに更新
            company.form_detection_status = FormDetectionStatus.ERROR
            company.form_detection_error_message = str(e)
            db.commit()
            raise
        
        try:
            async with self.browser_pool.get_page() as page:
                # 推奨ヘッダーを設定
                recommended_headers = self.compliance_manager.get_recommended_headers(url)
                await page.set_extra_http_headers(recommended_headers)
                
                # ページにアクセス
                logger.info(f"アクセス開始: {url}")
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                
                # 成功を記録
                self.compliance_manager.record_request_result(url, True)
                
                # 問い合わせリンクを検索
                contact_links = await self._find_contact_links(page, url)
                
                forms = []
                for link in contact_links:
                    try:
                        # 各リンクに対してもコンプライアンスチェック
                        link_compliance = await self.compliance_manager.check_compliance(link['url'])
                        
                        if not link_compliance.allowed:
                            logger.warning(f"フォームページがコンプライアンス違反: {link['url']}")
                            continue
                        
                        if link_compliance.delay_seconds > 0:
                            await asyncio.sleep(link_compliance.delay_seconds)
                        
                        # フォーム詳細を取得
                        form_details = await self._analyze_form_page(page, link['url'])
                        if form_details:
                            # フォームをデータベースに保存
                            saved_form = self._save_form_to_db(db, company_id, form_details)
                            
                            forms.append({
                                **link,
                                **form_details,
                                'id': saved_form['id'],
                                'compliance_warnings': link_compliance.warnings,
                                'compliance_delay': link_compliance.delay_seconds
                            })
                            
                            # 成功を記録
                            self.compliance_manager.record_request_result(link['url'], True)
                            
                    except Exception as e:
                        logger.error(f"フォーム解析エラー {link['url']}: {e}")
                        # 失敗を記録
                        self.compliance_manager.record_request_result(link['url'], False)
                        continue
                
                # フォーム検出完了時にステータスを更新
                company.form_detection_status = FormDetectionStatus.COMPLETED
                company.form_detection_completed_at = datetime.now(timezone.utc)
                company.detected_forms_count = len(forms)
                company.form_detection_error_message = None
                db.commit()
                
                logger.info(f"フォーム検出完了: 企業ID={company_id}, {len(forms)}個のフォームをデータベースに保存")
                return forms
                
        except Exception as e:
            logger.error(f"フォーム検出エラー {url}: {e}")
            # エラーステータスに更新
            company.form_detection_status = FormDetectionStatus.ERROR
            company.form_detection_error_message = str(e)
            db.commit()
            
            # 失敗を記録
            self.compliance_manager.record_request_result(url, False)
            raise
    
    async def _find_contact_links(self, page: Page, base_url: str) -> List[Dict]:
        """問い合わせページのリンクを検出"""
        contact_links = set()
        
        # 1. テキストベースのリンク検出
        for keyword in self.CONTACT_KEYWORDS:
            try:
                # case insensitive でリンクを検索
                links = await page.locator(f"a:has-text('{keyword}')").all()
                
                for link in links:
                    href = await link.get_attribute("href")
                    if href:
                        absolute_url = urljoin(base_url, href)
                        contact_links.add(absolute_url)
                        
            except Exception as e:
                logger.debug(f"キーワード '{keyword}' でのリンク検出エラー: {e}")
        
        # 2. href属性からの検出
        try:
            all_links = await page.locator("a[href]").all()
            
            for link in all_links:
                href = await link.get_attribute("href")
                if href and any(keyword.lower() in href.lower() for keyword in self.CONTACT_KEYWORDS):
                    absolute_url = urljoin(base_url, href)
                    contact_links.add(absolute_url)
                    
        except Exception as e:
            logger.debug(f"href属性からのリンク検出エラー: {e}")
        
        # 3. フッターやナビゲーションエリアでの検索
        try:
            footer_links = await page.locator("footer a, nav a, .footer a, .navigation a").all()
            
            for link in footer_links:
                text = await link.text_content()
                href = await link.get_attribute("href")
                
                if text and href and any(keyword in text for keyword in self.CONTACT_KEYWORDS):
                    absolute_url = urljoin(base_url, href)
                    contact_links.add(absolute_url)
                    
        except Exception as e:
            logger.debug(f"フッター/ナビゲーションでのリンク検出エラー: {e}")
        
        # 4. デフォルトの問い合わせURLパターンを試す
        default_paths = ["/contact", "/contact-us", "/inquiry", "/support"]
        for path in default_paths:
            contact_links.add(urljoin(base_url, path))
        
        # 重複除去とフィルタリング
        filtered_links = []
        for url in contact_links:
            if self._is_valid_contact_url(url, base_url):
                filtered_links.append({'url': url})
        
        logger.info(f"検出された問い合わせURL: {[link['url'] for link in filtered_links]}")
        return filtered_links[:5]  # 最大5つまで
    
    def _is_valid_contact_url(self, url: str, base_url: str) -> bool:
        """有効な問い合わせURLかどうか判定"""
        try:
            parsed_url = urlparse(url)
            base_parsed = urlparse(base_url)
            
            # 同じドメインまたはサブドメインかチェック
            if not (parsed_url.netloc == base_parsed.netloc or 
                   parsed_url.netloc.endswith(f".{base_parsed.netloc}")):
                return False
            
            # 除外パターン
            exclude_patterns = [
                r"javascript:", r"mailto:", r"tel:", r"#",
                r"\.(jpg|jpeg|png|gif|pdf|doc|docx)$"
            ]
            
            for pattern in exclude_patterns:
                if re.search(pattern, url, re.IGNORECASE):
                    return False
            
            return True
            
        except Exception:
            return False
    
    async def _analyze_form_page(self, page: Page, form_url: str) -> Optional[Dict[str, Any]]:
        """指定されたURLのページに移動してフォームを分析"""
        try:
            # ページに移動
            await page.goto(form_url, wait_until="domcontentloaded", timeout=30000)
            
            # フォームを分析
            forms = await self._analyze_forms(page, form_url)
            
            # 最初の（通常は最も適切な）フォームを返す
            if forms:
                return forms[0]
            else:
                logger.info(f"フォームが見つかりませんでした: {form_url}")
                return None
                
        except Exception as e:
            logger.error(f"フォームページ分析エラー {form_url}: {e}")
            return None
    
    async def _analyze_forms(self, page: Page, form_url: str) -> List[Dict[str, Any]]:
        """ページ内のフォームを解析"""
        forms = []
        
        try:
            # ページ内のすべてのフォーム要素を取得
            form_elements = await page.locator("form").all()
            
            if not form_elements:
                logger.info("フォーム要素が見つかりませんでした")
                return []
            
            for i, form_element in enumerate(form_elements):
                try:
                    form_data = await self._analyze_single_form(form_element, form_url, i, page)
                    if form_data:
                        forms.append(form_data)
                        
                except Exception as e:
                    logger.error(f"フォーム{i}の解析エラー: {e}")
                    continue
            
        except Exception as e:
            logger.error(f"フォーム解析エラー: {e}")
        
        return forms
    
    async def _analyze_single_form(self, form_element: Locator, form_url: str, form_index: int, page: Page) -> Optional[Dict[str, Any]]:
        """単一フォームの詳細解析"""
        try:
            # フォームフィールドを取得
            input_fields = await form_element.locator("input, textarea, select").all()
            
            if len(input_fields) < 2:  # 最低限のフィールド数チェック
                return None
            
            fields = []
            
            for field in input_fields:
                field_data = await self._analyze_field(field, page)
                if field_data:
                    fields.append(field_data)
            
            # 送信ボタンを検出
            submit_button = await self._find_submit_button(form_element)
            submit_selector = await self._get_field_selector(submit_button) if submit_button else ""
            
            # reCAPTCHAの有無をチェック
            has_recaptcha = await self._detect_recaptcha(form_element, page)
            
            return {
                "form_url": form_url,
                "fields": fields,
                "submit_button_selector": submit_selector,
                "has_recaptcha": has_recaptcha,
                "detected_at": datetime.now(timezone.utc)
            }
            
        except Exception as e:
            logger.error(f"単一フォーム解析エラー: {e}")
            return None
    
    async def _analyze_field(self, field: Locator, page: Page) -> Optional[Dict[str, Any]]:
        """フォームフィールドの詳細解析"""
        try:
            # 基本属性を取得
            tag_name = await field.evaluate("el => el.tagName.toLowerCase()")
            field_type = await field.get_attribute("type") or "text"
            name = await field.get_attribute("name") or ""
            field_id = await field.get_attribute("id") or ""
            placeholder = await field.get_attribute("placeholder") or ""
            required = await field.evaluate("el => el.required")
            
            # ラベルを検出
            label = await self._find_field_label(field, page)
            
            # フィールドタイプを判定
            detected_type = self._determine_field_type(
                tag_name, field_type, name, field_id, placeholder, label
            )
            
            # セレクトボックスの選択肢を取得
            options = []
            if tag_name == "select":
                option_elements = await field.locator("option").all()
                for option in option_elements:
                    option_text = await option.text_content()
                    option_value = await option.get_attribute("value")
                    if option_text and option_text.strip():
                        options.append(option_text.strip())
            
            # セレクタを生成
            selector = await self._get_field_selector(field)
            
            return {
                "name": name or field_id or f"field_{selector}",
                "field_type": detected_type,
                "selector": selector,
                "label": label,
                "required": required,
                "options": options if options else None
            }
            
        except Exception as e:
            logger.error(f"フィールド解析エラー: {e}")
            return None
    
    async def _find_field_label(self, field: Locator, page: Page) -> Optional[str]:
        """フィールドのラベルを検出"""
        try:
            # aria-label属性
            aria_label = await field.get_attribute("aria-label")
            if aria_label:
                return aria_label.strip()
            
            # label要素（for属性）
            field_id = await field.get_attribute("id")
            if field_id:
                try:
                    label_element = page.locator(f"label[for='{field_id}']")
                    label_text = await label_element.text_content()
                    if label_text:
                        return label_text.strip()
                except:
                    pass
            
            # 親要素のlabel
            try:
                parent_label = field.locator("xpath=ancestor::label[1]")
                label_text = await parent_label.text_content()
                if label_text:
                    return label_text.strip()
            except:
                pass
            
            # 近くのテキスト要素を検索
            try:
                # 前の兄弟要素
                prev_sibling = field.locator("xpath=preceding-sibling::*[1]")
                prev_text = await prev_sibling.text_content()
                if prev_text and len(prev_text.strip()) < 50:
                    return prev_text.strip()
            except:
                pass
            
            return None
            
        except Exception as e:
            logger.debug(f"ラベル検出エラー: {e}")
            return None
    
    def _determine_field_type(self, tag_name: str, field_type: str, name: str, field_id: str, placeholder: str, label: str) -> FormFieldType:
        """フィールドタイプを判定"""
        # すべての情報を結合して判定
        combined_text = " ".join(filter(None, [field_type, name, field_id, placeholder, label])).lower()
        
        # textareaタグの場合
        if tag_name == "textarea":
            return FormFieldType.TEXTAREA
        
        # selectタグの場合
        if tag_name == "select":
            return FormFieldType.SELECT
        
        # inputタグの場合、type属性をチェック
        if field_type:
            if field_type.lower() in ["email"]:
                return FormFieldType.EMAIL
            elif field_type.lower() in ["tel", "phone"]:
                return FormFieldType.TEL
            elif field_type.lower() in ["radio"]:
                return FormFieldType.RADIO
            elif field_type.lower() in ["checkbox"]:
                return FormFieldType.CHECKBOX
        
        # パターンマッチング
        for form_type, patterns in self.FIELD_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, combined_text, re.IGNORECASE):
                    return form_type
        
        # デフォルトはtext
        return FormFieldType.TEXT
    
    async def _get_field_selector(self, field: Locator) -> str:
        """フィールドのCSSセレクタを生成"""
        try:
            # id属性がある場合
            field_id = await field.get_attribute("id")
            if field_id:
                return f"#{field_id}"
            
            # name属性がある場合
            name = await field.get_attribute("name")
            if name:
                return f"[name='{name}']"
            
            # クラス属性がある場合
            class_name = await field.get_attribute("class")
            if class_name:
                classes = class_name.split()
                if classes:
                    return f".{classes[0]}"
            
            # type属性がある場合
            field_type = await field.get_attribute("type")
            if field_type:
                return f"input[type='{field_type}']"
            
            # タグ名のみ
            tag_name = await field.evaluate("el => el.tagName.toLowerCase()")
            return tag_name
            
        except Exception as e:
            logger.error(f"セレクタ生成エラー: {e}")
            return "input"
    
    async def _find_submit_button(self, form_element: Locator) -> Optional[Locator]:
        """送信ボタンを検出"""
        try:
            # type="submit"のボタン
            submit_input = form_element.locator("input[type='submit'], button[type='submit']")
            if await submit_input.count() > 0:
                return submit_input.first
            
            # ボタンタグ
            buttons = await form_element.locator("button").all()
            for button in buttons:
                button_text = await button.text_content()
                if button_text:
                    button_text = button_text.lower()
                    if any(keyword in button_text for keyword in ["送信", "submit", "send", "確認", "登録"]):
                        return button
            
            # inputタグでvalue属性に送信系の文字
            inputs = await form_element.locator("input").all()
            for input_elem in inputs:
                value = await input_elem.get_attribute("value")
                if value:
                    value = value.lower()
                    if any(keyword in value for keyword in ["送信", "submit", "send", "確認", "登録"]):
                        return input_elem
            
            return None
            
        except Exception as e:
            logger.error(f"送信ボタン検出エラー: {e}")
            return None
    
    async def _detect_recaptcha(self, form_element: Locator, page: Page) -> bool:
        """reCAPTCHAの有無を検出"""
        try:
            # reCAPTCHA関連の要素を検索
            recaptcha_selectors = [
                ".g-recaptcha",
                "[data-sitekey]",
                "iframe[src*='recaptcha']",
                ".recaptcha",
                "#recaptcha"
            ]
            
            for selector in recaptcha_selectors:
                if await form_element.locator(selector).count() > 0:
                    return True
            
            # ページ全体でもチェック
            for selector in recaptcha_selectors:
                if await page.locator(selector).count() > 0:
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"reCAPTCHA検出エラー: {e}")
            return False
    
    def _save_form_to_db(self, db: Session, company_id: int, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """フォームデータをデータベースに保存"""
        try:
            # フォームレコードを作成
            form = Form(
                company_id=company_id,
                form_url=form_data["form_url"],
                submit_button_selector=form_data["submit_button_selector"],
                has_recaptcha=form_data["has_recaptcha"],
                detected_at=form_data["detected_at"]
            )
            
            db.add(form)
            db.flush()  # IDを取得するためにflush
            
            # フィールドレコードを作成
            for field_data in form_data["fields"]:
                field = FormField(
                    form_id=form.id,
                    name=field_data["name"],
                    field_type=field_data["field_type"].value,
                    selector=field_data["selector"],
                    label=field_data["label"],
                    required=field_data["required"],
                    options=field_data["options"]
                )
                db.add(field)
            
            db.commit()
            
            logger.info(f"フォームをデータベースに保存: ID={form.id}")
            
            return {
                "id": form.id,
                "company_id": form.company_id,
                "form_url": form.form_url,
                "fields_count": len(form_data["fields"]),
                "has_recaptcha": form.has_recaptcha,
                "detected_at": form.detected_at
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"データベース保存エラー: {e}")
            raise


# グローバルインスタンス
form_detector = FormDetector(browser_pool) 