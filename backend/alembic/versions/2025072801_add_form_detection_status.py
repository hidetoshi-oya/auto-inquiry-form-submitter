"""Add form detection status fields to companies table

Revision ID: 2025072801_add_form_detection_status
Revises: bf159aabd1f3
Create Date: 2025-07-28 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025072801_add_form_detection_status'
down_revision = 'bf159aabd1f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add form detection status fields to companies table"""
    # Create the new enum type for form detection status
    form_detection_status_enum = sa.Enum(
        'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ERROR',
        name='formdetectionstatus'
    )
    form_detection_status_enum.create(op.get_bind())
    
    # Add new columns to companies table
    op.add_column('companies', sa.Column(
        'form_detection_status',
        form_detection_status_enum,
        server_default='NOT_STARTED',
        nullable=False,
        comment='フォーム検出ステータス'
    ))
    
    op.add_column('companies', sa.Column(
        'form_detection_completed_at',
        sa.DateTime(),
        nullable=True,
        comment='フォーム検出完了日時'
    ))
    
    op.add_column('companies', sa.Column(
        'detected_forms_count',
        sa.Integer(),
        server_default='0',
        nullable=False,
        comment='検出されたフォーム数'
    ))
    
    op.add_column('companies', sa.Column(
        'form_detection_error_message',
        sa.Text(),
        nullable=True,
        comment='フォーム検出エラーメッセージ'
    ))


def downgrade() -> None:
    """Remove form detection status fields from companies table"""
    # Drop the added columns
    op.drop_column('companies', 'form_detection_error_message')
    op.drop_column('companies', 'detected_forms_count')
    op.drop_column('companies', 'form_detection_completed_at')
    op.drop_column('companies', 'form_detection_status')
    
    # Drop the enum type
    form_detection_status_enum = sa.Enum(name='formdetectionstatus')
    form_detection_status_enum.drop(op.get_bind())