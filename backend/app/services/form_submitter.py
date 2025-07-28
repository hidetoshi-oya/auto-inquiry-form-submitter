"""
フォーム自動入力・送信システム
検出されたフォームに対してテンプレートデータを自動入力・送信
"""
import asyncio
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import logging
import json
from pathlib import Path

from playwright.async_api import Page, Locator
from sqlalchemy.orm import Session

from app.services.browser_pool import browser_pool
from app.models.form import Form, FormField
from app.models.template import Template, TemplateField
from app.models.submission import Submission
from app.schemas.form import FormFieldType
from app.schemas.submission import SubmissionStatus

logger = logging.getLogger(__name__)


class FormSubmitter:
    """フォーム自動入力・送信クラス"""
    
    def __init__(self):
        self.current_page: Optional[Page] = None
        self.screenshots_dir = Path("screenshots")
        self.screenshots_dir.mkdir(exist_ok=True)
    
    async def submit_form(
        self,
        form_id: int,
        template_id: int,
        template_data: Dict[str, Any],
        db: Session,
        take_screenshot: bool = True,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """フォームを自動入力・送信"""
        logger.info(f"フォーム送信開始: form_id={form_id}, template_id={template_id}")
        
        try:
            # フォーム情報を取得
            form = db.query(Form).filter(Form.id == form_id).first()
            if not form:
                raise ValueError(f"フォームが見つかりません: ID={form_id}")
            
            # 送信記録を作成
            submission = Submission(
                company_id=form.company_id,
                form_id=form_id,
                template_id=template_id,
                status=SubmissionStatus.PENDING,
                submitted_data=template_data,
                submitted_at=datetime.now(timezone.utc)
            )
            db.add(submission)
            db.flush()
            
            result = await self._execute_submission(
                form, template_data, submission.id, take_screenshot, dry_run
            )
            
            # 結果を更新
            submission.status = result["status"]
            submission.response = result.get("response")
            submission.error_message = result.get("error_message")
            submission.screenshot_url = result.get("screenshot_url")
            
            db.commit()
            
            logger.info(f"フォーム送信完了: submission_id={submission.id}, status={submission.status}")
            
            return {
                "submission_id": submission.id,
                "status": submission.status.value,
                "form_url": form.form_url,
                "has_recaptcha": form.has_recaptcha,
                "screenshot_url": submission.screenshot_url,
                "response": submission.response,
                "error_message": submission.error_message,
                "submitted_at": submission.submitted_at
            }
            
        except Exception as e:
            logger.error(f"フォーム送信エラー: {e}")
            if 'submission' in locals():
                submission.status = SubmissionStatus.FAILED
                submission.error_message = str(e)
                db.commit()
            raise
    
    async def _execute_submission(
        self,
        form: Form,
        template_data: Dict[str, Any],
        submission_id: int,
        take_screenshot: bool,
        dry_run: bool
    ) -> Dict[str, Any]:
        """実際の送信処理を実行"""
        
        async with browser_pool.get_page() as page:
            self.current_page = page
            
            try:
                # フォームページに移動
                logger.info(f"フォームページに移動: {form.form_url}")
                await page.goto(form.form_url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(2000)
                
                # reCAPTCHA検出
                if form.has_recaptcha:
                    has_captcha = await self._detect_active_recaptcha(page)
                    if has_captcha:
                        logger.warning("reCAPTCHAが検出されました。手動介入が必要です。")
                        return {
                            "status": SubmissionStatus.CAPTCHA_REQUIRED,
                            "response": "reCAPTCHA detected. Manual intervention required.",
                            "screenshot_url": await self._take_screenshot(page, submission_id, "captcha") if take_screenshot else None
                        }
                
                # フォームフィールドにデータを入力
                await self._fill_form_fields(page, form, template_data)
                
                # スクリーンショットを撮影（送信前）
                screenshot_url = None
                if take_screenshot:
                    screenshot_url = await self._take_screenshot(page, submission_id, "before_submit")
                
                if dry_run:
                    logger.info("ドライランモード: 実際の送信はスキップします")
                    return {
                        "status": SubmissionStatus.SUCCESS,
                        "response": "Dry run completed successfully",
                        "screenshot_url": screenshot_url
                    }
                
                # フォーム送信
                submission_result = await self._submit_form(page, form)
                
                # 送信後のスクリーンショット
                if take_screenshot:
                    after_screenshot_url = await self._take_screenshot(page, submission_id, "after_submit")
                    screenshot_url = screenshot_url or after_screenshot_url
                
                return {
                    "status": submission_result["status"],
                    "response": submission_result["response"],
                    "screenshot_url": screenshot_url
                }
                
            except Exception as e:
                logger.error(f"送信処理エラー: {e}")
                error_screenshot_url = None
                if take_screenshot:
                    error_screenshot_url = await self._take_screenshot(page, submission_id, "error")
                
                return {
                    "status": SubmissionStatus.FAILED,
                    "error_message": str(e),
                    "screenshot_url": error_screenshot_url
                }
    
    async def _fill_form_fields(self, page: Page, form: Form, template_data: Dict[str, Any]) -> None:
        """フォームフィールドにデータを入力"""
        logger.info("フォームフィールドへの入力を開始")
        
        for field in form.fields:
            try:
                # テンプレートデータからマッピング
                field_value = self._map_template_data_to_field(field, template_data)
                
                if field_value is None:
                    if field.required:
                        logger.warning(f"必須フィールドにデータがありません: {field.name}")
                    continue
                
                # フィールドを取得
                locator = page.locator(field.selector)
                
                # フィールドが存在するかチェック
                if await locator.count() == 0:
                    logger.warning(f"フィールドが見つかりません: {field.selector}")
                    continue
                
                # フィールドタイプに応じて入力
                await self._input_field_value(locator, field, field_value)
                
                logger.debug(f"フィールド入力完了: {field.name} = {field_value}")
                
                # 入力後の短い待機
                await page.wait_for_timeout(500)
                
            except Exception as e:
                logger.error(f"フィールド入力エラー: {field.name}, {e}")
                if field.required:
                    raise
    
    def _map_template_data_to_field(self, field: FormField, template_data: Dict[str, Any]) -> Optional[str]:
        """テンプレートデータをフィールドにマッピング"""
        
        # 直接のフィールド名マッチング
        if field.name in template_data:
            return str(template_data[field.name])
        
        # ラベルベースのマッチング
        if field.label:
            label_lower = field.label.lower()
            
            # 会社名のマッピング
            if any(keyword in label_lower for keyword in ["会社名", "企業名", "company", "corporation"]):
                return template_data.get("company_name")
            
            # 担当者名のマッピング
            if any(keyword in label_lower for keyword in ["名前", "お名前", "担当者", "name", "contact"]):
                return template_data.get("contact_name")
            
            # メールアドレスのマッピング
            if any(keyword in label_lower for keyword in ["メール", "email", "mail"]):
                return template_data.get("email")
            
            # 電話番号のマッピング
            if any(keyword in label_lower for keyword in ["電話", "tel", "phone"]):
                return template_data.get("phone")
            
            # 問い合わせ内容のマッピング
            if any(keyword in label_lower for keyword in ["内容", "メッセージ", "問い合わせ", "message", "inquiry", "content"]):
                return template_data.get("message")
        
        # フィールドタイプベースのマッピング
        if field.field_type == FormFieldType.EMAIL.value:
            return template_data.get("email")
        elif field.field_type == FormFieldType.TEL.value:
            return template_data.get("phone")
        elif field.field_type == FormFieldType.TEXTAREA.value:
            return template_data.get("message")
        
        return None
    
    async def _input_field_value(self, locator: Locator, field: FormField, value: str) -> None:
        """フィールドタイプに応じて値を入力"""
        
        field_type = FormFieldType(field.field_type)
        
        if field_type in [FormFieldType.TEXT, FormFieldType.EMAIL, FormFieldType.TEL]:
            # テキスト系フィールド
            await locator.clear()
            await locator.fill(value)
            
        elif field_type == FormFieldType.TEXTAREA:
            # テキストエリア
            await locator.clear()
            await locator.fill(value)
            
        elif field_type == FormFieldType.SELECT:
            # セレクトボックス
            try:
                await locator.select_option(value)
            except:
                # 値で選択できない場合は、ラベルで試す
                try:
                    await locator.select_option(label=value)
                except:
                    logger.warning(f"セレクトボックスの選択に失敗: {value}")
                    
        elif field_type == FormFieldType.RADIO:
            # ラジオボタン
            radio_options = await locator.all()
            for radio in radio_options:
                radio_value = await radio.get_attribute("value")
                if radio_value and radio_value.lower() == value.lower():
                    await radio.check()
                    break
                    
        elif field_type == FormFieldType.CHECKBOX:
            # チェックボックス
            if value.lower() in ["true", "1", "yes", "on", "checked"]:
                await locator.check()
            else:
                await locator.uncheck()
    
    async def _submit_form(self, page: Page, form: Form) -> Dict[str, Any]:
        """フォームを送信"""
        logger.info("フォーム送信を実行")
        
        try:
            if form.submit_button_selector:
                # 送信ボタンがある場合
                submit_button = page.locator(form.submit_button_selector)
                
                if await submit_button.count() == 0:
                    logger.warning("送信ボタンが見つかりません。代替手段を試します")
                    submit_button = await self._find_alternative_submit_button(page)
                else:
                    submit_button = submit_button.first
            else:
                # 送信ボタンを自動検出
                submit_button = await self._find_alternative_submit_button(page)
            
            if not submit_button:
                raise Exception("送信ボタンが見つかりません")
            
            # 送信前の現在URLを記録
            current_url = page.url
            
            # 送信ボタンをクリック
            await submit_button.click()
            
            # ページの変化を待つ
            try:
                # URLの変化またはアラート/確認ダイアログを待つ
                await page.wait_for_load_state("domcontentloaded", timeout=10000)
                await page.wait_for_timeout(2000)
            except:
                pass
            
            # 送信結果を判定
            return await self._determine_submission_result(page, current_url)
            
        except Exception as e:
            logger.error(f"フォーム送信エラー: {e}")
            return {
                "status": SubmissionStatus.FAILED,
                "response": f"送信エラー: {str(e)}"
            }
    
    async def _find_alternative_submit_button(self, page: Page) -> Optional[Locator]:
        """代替送信ボタンを検出"""
        
        # type="submit"のボタン
        submit_buttons = page.locator("input[type='submit'], button[type='submit']")
        if await submit_buttons.count() > 0:
            return submit_buttons.first
        
        # テキストベースの検出
        text_patterns = ["送信", "submit", "send", "確認", "登録", "申し込み"]
        
        for pattern in text_patterns:
            buttons = page.locator(f"button:has-text('{pattern}'), input[value*='{pattern}']")
            if await buttons.count() > 0:
                return buttons.first
        
        # 最後の手段: formタグ内の最後のボタン
        form_buttons = page.locator("form button, form input[type='button']")
        if await form_buttons.count() > 0:
            return form_buttons.last
        
        return None
    
    async def _determine_submission_result(self, page: Page, original_url: str) -> Dict[str, Any]:
        """送信結果を判定"""
        
        current_url = page.url
        page_content = await page.content()
        
        # 成功パターンの検出
        success_patterns = [
            "ありがとうございました", "送信完了", "受付完了", "thank you",
            "success", "submitted", "送信いたしました", "お問い合わせを受け付けました"
        ]
        
        for pattern in success_patterns:
            if pattern in page_content.lower():
                return {
                    "status": SubmissionStatus.SUCCESS,
                    "response": f"送信成功: {pattern} が検出されました"
                }
        
        # URLが変化した場合（リダイレクト）
        if current_url != original_url:
            return {
                "status": SubmissionStatus.SUCCESS,
                "response": f"送信完了（リダイレクト先: {current_url}）"
            }
        
        # エラーパターンの検出
        error_patterns = [
            "エラー", "error", "失敗", "failed", "必須", "required",
            "正しく", "invalid", "入力してください", "確認してください"
        ]
        
        for pattern in error_patterns:
            if pattern in page_content.lower():
                return {
                    "status": SubmissionStatus.FAILED,
                    "response": f"送信エラー: {pattern} が検出されました"
                }
        
        # 判定不明の場合
        return {
            "status": SubmissionStatus.SUCCESS,
            "response": "送信完了（結果判定: 不明）"
        }
    
    async def _detect_active_recaptcha(self, page: Page) -> bool:
        """アクティブなreCAPTCHAを検出"""
        try:
            # reCAPTCHA関連の要素を検索
            recaptcha_selectors = [
                ".g-recaptcha:visible",
                "iframe[src*='recaptcha']:visible",
                "[data-sitekey]:visible"
            ]
            
            for selector in recaptcha_selectors:
                if await page.locator(selector).count() > 0:
                    return True
            
            # reCAPTCHAのチェックボックスが表示されているかチェック
            recaptcha_checkbox = page.locator(".recaptcha-checkbox")
            if await recaptcha_checkbox.count() > 0 and await recaptcha_checkbox.is_visible():
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"reCAPTCHA検出エラー: {e}")
            return False
    
    async def _take_screenshot(self, page: Page, submission_id: int, suffix: str) -> str:
        """スクリーンショットを撮影"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"submission_{submission_id}_{suffix}_{timestamp}.png"
            screenshot_path = self.screenshots_dir / filename
            
            await page.screenshot(path=str(screenshot_path), full_page=True)
            
            # 相対パスを返す（S3アップロード等の処理は別途実装）
            return f"screenshots/{filename}"
            
        except Exception as e:
            logger.error(f"スクリーンショット撮影エラー: {e}")
            return None


# グローバルインスタンス
form_submitter = FormSubmitter() 