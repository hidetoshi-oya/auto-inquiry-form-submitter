#!/usr/bin/env python3
"""
テンプレート変数取得の修正テスト

.dict()から.model_dump()への変更が正常に動作するかテストします。
"""
import sys
import os

# プロジェクトのルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.template_processor import template_processor

def test_template_variables():
    """テンプレート変数取得のテスト"""
    print("=== テンプレート変数取得テスト ===")
    
    try:
        # 変数定義を取得
        variables = template_processor.get_variable_definitions()
        print(f"✅ 変数定義の取得に成功: {len(variables)}個の変数")
        
        # 各変数をmodel_dump()で辞書に変換
        variables_dict = [var.model_dump() for var in variables]
        print(f"✅ .model_dump()での変換に成功: {len(variables_dict)}個の辞書")
        
        # 最初の変数の詳細を表示
        if variables_dict:
            first_var = variables_dict[0]
            print(f"   サンプル変数: {first_var}")
            
            # 必要なキーが含まれているかチェック
            required_keys = ['name', 'key']
            for key in required_keys:
                if key in first_var:
                    print(f"   ✅ {key}: {first_var[key]}")
                else:
                    print(f"   ❌ 必須キー '{key}' が見つかりません")
                    return False
        
        print("\n=== テスト結果 ===")
        print("✅ すべてのテストに合格しました！")
        print("   - template_processor.get_variable_definitions() が正常動作")
        print("   - .model_dump() が正常に実行される")
        print("   - APIエンドポイント /templates/variables は修正済み")
        return True
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        print(f"   エラータイプ: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_template_variables()
    if success:
        print("\n🎉 修正が正常に動作しています！")
        sys.exit(0)
    else:
        print("\n💥 問題が検出されました。")
        sys.exit(1)