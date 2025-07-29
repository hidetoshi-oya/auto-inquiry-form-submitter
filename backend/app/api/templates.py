from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api import deps
from app.core.database import get_db
from app.models.template import Template
from app.models.user import User
from app.schemas.template import (
    Template as TemplateSchema, 
    TemplateCreate, 
    TemplateUpdate,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    TemplateValidationResponse,
    TemplateVariablesResponse,
    TemplateCategoriesResponse,
    TemplateCategoryStats
)
from app.services.template_processor import template_processor

router = APIRouter()


@router.get("/debug/count")
def debug_template_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """デバッグ用：テンプレート数とサンプル確認"""
    try:
        print(f"🔍 [Debug] デバッグエンドポイント呼び出し")
        print(f"🔍 [Debug] 現在のユーザー: {current_user.id if current_user else 'None'}")
        
        # 総テンプレート数
        total_count = db.query(Template).count()
        print(f"🔍 [Debug] 総テンプレート数: {total_count}")
        
        # fieldsテーブルの総数
        from app.models.template import TemplateField, TemplateVariable
        fields_count = db.query(TemplateField).count()
        variables_count = db.query(TemplateVariable).count()
        print(f"🔍 [Debug] 総フィールド数: {fields_count}, 総変数数: {variables_count}")
        
        # サンプルテンプレート（リレーション込み）
        sample_templates = db.query(Template).options(
            joinedload(Template.fields),
            joinedload(Template.variables)
        ).limit(3).all()
        
        print(f"🔍 [Debug] サンプルテンプレート取得: {len(sample_templates)}件")
        
        sample_data = []
        for i, template in enumerate(sample_templates):
            print(f"🔍 [Debug] サンプル{i+1}: ID={template.id}, name='{template.name}', fields={len(template.fields)}, vars={len(template.variables)}")
            sample_data.append({
                "id": template.id,
                "name": template.name,
                "category": template.category,
                "fields_count": len(template.fields),
                "variables_count": len(template.variables),
                "fields": [{"key": f.key, "value": f.value, "type": f.field_type} for f in template.fields],
                "variables": [{"name": v.name, "key": v.key, "default": v.default_value} for v in template.variables]
            })
        
        result = {
            "total_templates": total_count,
            "total_fields": fields_count,
            "total_variables": variables_count,
            "sample_templates": sample_data
        }
        
        print(f"🔍 [Debug] レスポンス準備完了: {result}")
        return result
        
    except Exception as e:
        print(f"❌ [Debug] デバッグエンドポイントエラー: {e}")
        print(f"❌ [Debug] エラー詳細: {str(e)}")
        import traceback
        print(f"❌ [Debug] スタックトレース: {traceback.format_exc()}")
        
        # エラーレスポンスを返す
        return {
            "error": str(e),
            "total_templates": 0,
            "total_fields": 0,
            "total_variables": 0,
            "sample_templates": []
        }


@router.get("/", response_model=List[TemplateSchema])
def read_templates(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    category: str = None,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレート一覧を取得"""
    print(f"🔍 [Backend] テンプレート一覧取得開始 - skip: {skip}, limit: {limit}, category: {category}")
    print(f"🔍 [Backend] 現在のユーザー: {current_user.id if current_user else 'None'}")
    
    query = db.query(Template).options(
        joinedload(Template.fields),
        joinedload(Template.variables)
    )
    if category:
        query = query.filter(Template.category == category)
        print(f"🔍 [Backend] カテゴリフィルタ適用: {category}")
    
    templates = query.offset(skip).limit(limit).all()
    print(f"🔍 [Backend] DB取得結果: {len(templates)}件のテンプレート")
    
    # 詳細ログ
    for i, template in enumerate(templates):
        print(f"🔍 [Backend] テンプレート{i+1}: ID={template.id}, name='{template.name}', category='{template.category}'")
        print(f"🔍 [Backend]   fields: {len(template.fields)}件, variables: {len(template.variables)}件")
        for j, field in enumerate(template.fields):
            print(f"🔍 [Backend]     field{j+1}: key='{field.key}', value='{field.value}', type='{field.field_type}'")
        for j, var in enumerate(template.variables):
            print(f"🔍 [Backend]     variable{j+1}: name='{var.name}', key='{var.key}', default='{var.default_value}'")
    
    print(f"🔍 [Backend] レスポンス準備完了")
    return templates


@router.post("/", response_model=TemplateSchema)
def create_template(
    *,
    db: Session = Depends(get_db),
    template_in: TemplateCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """新規テンプレートを作成"""
    from app.models.template import TemplateField, TemplateVariable
    
    # テンプレート本体を作成
    template_data = template_in.model_dump(exclude={'fields', 'variables'})
    template = Template(**template_data)
    db.add(template)
    db.flush()  # IDを取得するためにflush
    
    # フィールドを作成
    for field_data in template_in.fields:
        field = TemplateField(
            template_id=template.id,
            **field_data.model_dump()
        )
        db.add(field)
    
    # 変数を作成
    for variable_data in template_in.variables:
        variable = TemplateVariable(
            template_id=template.id,
            **variable_data.model_dump()
        )
        db.add(variable)
    
    db.commit()
    db.refresh(template)
    return template


@router.get("/categories", response_model=TemplateCategoriesResponse)
def get_template_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレートカテゴリ統計を取得"""
    from sqlalchemy import func
    
    # カテゴリ別の統計を取得
    category_stats = db.query(
        Template.category,
        func.count(Template.id).label('count'),
        func.max(Template.updated_at).label('last_updated')
    ).group_by(Template.category).all()
    
    # 総テンプレート数を取得
    total_templates = db.query(func.count(Template.id)).scalar()
    
    # レスポンスデータを構築
    categories = []
    for stat in category_stats:
        categories.append(TemplateCategoryStats(
            category=stat.category,
            count=stat.count,
            last_updated=stat.last_updated
        ))
    
    return TemplateCategoriesResponse(
        categories=categories,
        total_templates=total_templates or 0
    )


@router.get("/variables", response_model=TemplateVariablesResponse)
def get_template_variables(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """利用可能なテンプレート変数一覧を取得"""
    variables = template_processor.get_variable_definitions()
    
    return TemplateVariablesResponse(
        variables=[var.model_dump() for var in variables]
    )


@router.get("/{template_id}", response_model=TemplateSchema)
def read_template(
    *,
    db: Session = Depends(get_db),
    template_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレート詳細を取得"""
    template = db.query(Template).options(
        joinedload(Template.fields),
        joinedload(Template.variables)
    ).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=TemplateSchema)
def update_template(
    *,
    db: Session = Depends(get_db),
    template_id: int,
    template_in: TemplateUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレートを更新"""
    from app.models.template import TemplateField, TemplateVariable
    
    template = db.query(Template).options(
        joinedload(Template.fields),
        joinedload(Template.variables)
    ).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # 基本フィールドを更新
    update_data = template_in.model_dump(exclude_unset=True, exclude={'fields', 'variables'})
    for field, value in update_data.items():
        setattr(template, field, value)
    
    # フィールドを更新
    if template_in.fields is not None:
        # 既存のフィールドを削除
        db.query(TemplateField).filter(TemplateField.template_id == template_id).delete()
        
        # 新しいフィールドを追加
        for field_data in template_in.fields:
            field = TemplateField(
                template_id=template_id,
                **field_data.model_dump()
            )
            db.add(field)
    
    # 変数を更新
    if template_in.variables is not None:
        # 既存の変数を削除
        db.query(TemplateVariable).filter(TemplateVariable.template_id == template_id).delete()
        
        # 新しい変数を追加
        for variable_data in template_in.variables:
            variable = TemplateVariable(
                template_id=template_id,
                **variable_data.model_dump()
            )
            db.add(variable)
    
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", response_model=TemplateSchema)
def delete_template(
    *,
    db: Session = Depends(get_db),
    template_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレートを削除"""
    template = db.query(Template).options(
        joinedload(Template.fields),
        joinedload(Template.variables)
    ).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(template)
    db.commit()
    return template


@router.post("/preview", response_model=TemplatePreviewResponse)
def preview_template(
    *,
    preview_request: TemplatePreviewRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレートのプレビューを生成"""
    result = template_processor.get_preview(
        preview_request.template_content,
        preview_request.variables
    )
    
    return TemplatePreviewResponse(
        success=result['success'],
        preview=result['preview'],
        variables_used=result['variables_used'],
        available_variables=result.get('available_variables', []),
        error=result.get('error')
    )


@router.post("/validate", response_model=TemplateValidationResponse)
def validate_template(
    *,
    template_content: str,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """テンプレートの妥当性を検証"""
    result = template_processor.validate_template(template_content)
    
    return TemplateValidationResponse(
        valid=result['valid'],
        variables=result['variables'],
        error=result['error']
    )


@router.get("/{template_id}/preview", response_model=TemplatePreviewResponse)
def preview_template_by_id(
    *,
    db: Session = Depends(get_db),
    template_id: int,
    variables: dict = None,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """保存済みテンプレートのプレビューを生成"""
    template = db.query(Template).options(
        joinedload(Template.fields),
        joinedload(Template.variables)
    ).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # テンプレートフィールドからコンテンツを構築
    template_content = ""
    for field in template.fields:
        template_content += f"{field.key}: {field.value}\n"
    
    if variables is None:
        variables = {}
    
    result = template_processor.get_preview(template_content, variables)
    
    return TemplatePreviewResponse(
        success=result['success'],
        preview=result['preview'],
        variables_used=result['variables_used'],
        available_variables=result.get('available_variables', []),
        error=result.get('error')
    )

