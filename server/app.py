from flask import Flask, request, jsonify
from flask_cors import CORS
from database import get_connection, init_database
from datetime import datetime
import pymysql

app = Flask(__name__)
CORS(app)

# 初始化数据库
init_database()

# ==================== 账户接口 ====================

@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    """获取所有账户"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM accounts WHERE is_deleted = 0 ORDER BY created_at")
    accounts = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify({'success': True, 'data': accounts})

@app.route('/api/accounts', methods=['POST'])
def create_account():
    """创建账户"""
    data = request.json
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO accounts (id, name, type, balance, remark, currency, scope)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (data['id'], data['name'], data['type'], data['balance'],
              data.get('remark', ''), data.get('currency', '人民币'), data.get('scope', '')))

        conn.commit()
        cursor.execute("SELECT * FROM accounts WHERE id = %s", (data['id'],))
        account = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'data': account})
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/accounts/<account_id>', methods=['PUT'])
def update_account(account_id):
    """更新账户"""
    data = request.json
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE accounts
            SET name = %s, balance = %s, remark = %s
            WHERE id = %s
        """, (data['name'], data['balance'], data.get('remark', ''), account_id))

        conn.commit()
        cursor.execute("SELECT * FROM accounts WHERE id = %s", (account_id,))
        account = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'data': account})
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/accounts/<account_id>', methods=['DELETE'])
def delete_account(account_id):
    """删除账户（软删除）"""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("UPDATE accounts SET is_deleted = 1 WHERE id = %s", (account_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== 记账记录接口 ====================

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """获取所有记账记录"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, a.name as account_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.is_deleted = 0
        ORDER BY t.created_at DESC
    """)
    transactions = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify({'success': True, 'data': transactions})

@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    """创建记账记录"""
    data = request.json
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO transactions (id, account_id, category, type, amount, currency, unit, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (data['id'], data['account_id'], data['category'], data.get('type', ''),
              data['amount'], data.get('currency', 'CNY'), data.get('unit', ''), data.get('remark', '')))

        # 更新账户余额
        if data['category'] == 'income':
            cursor.execute("UPDATE accounts SET balance = balance + %s WHERE id = %s",
                         (data['amount'], data['account_id']))
        elif data['category'] == 'expense':
            cursor.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s",
                         (data['amount'], data['account_id']))

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/transactions/<transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """删除记账记录"""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 先获取记录信息
        cursor.execute("SELECT * FROM transactions WHERE id = %s", (transaction_id,))
        trans = cursor.fetchone()

        if trans:
            # 恢复账户余额
            if trans['category'] == 'income':
                cursor.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s",
                             (trans['amount'], trans['account_id']))
            elif trans['category'] == 'expense':
                cursor.execute("UPDATE accounts SET balance = balance + %s WHERE id = %s",
                             (trans['amount'], trans['account_id']))

        cursor.execute("UPDATE transactions SET is_deleted = 1 WHERE id = %s", (transaction_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== 同步接口 ====================

@app.route('/api/sync', methods=['POST'])
def sync_data():
    """同步数据（上传本地数据到云端）"""
    data = request.json
    client_id = data.get('client_id', 'unknown')

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 同步账户
        if 'accounts' in data:
            for account in data['accounts']:
                cursor.execute("""
                    INSERT INTO accounts (id, name, type, balance, remark, currency, scope)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                    name = VALUES(name), balance = VALUES(balance), remark = VALUES(remark)
                """, (account['id'], account['name'], account['type'], account['balance'],
                      account.get('remark', ''), account.get('currency', '人民币'), account.get('scope', '')))

        # 同步记账记录
        if 'transactions' in data:
            for trans in data['transactions']:
                cursor.execute("""
                    INSERT INTO transactions (id, account_id, category, type, amount, currency, unit, remark)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                    category = VALUES(category), type = VALUES(type), amount = VALUES(amount)
                """, (trans['id'], trans['account_id'], trans['category'], trans.get('type', ''),
                      trans['amount'], trans.get('currency', 'CNY'), trans.get('unit', ''), trans.get('remark', '')))

        conn.commit()

        # 记录同步日志
        cursor.execute("""
            INSERT INTO sync_log (client_id, sync_type, data_type)
            VALUES (%s, 'upload', 'full')
        """, (client_id,))

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': '同步成功'})
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sync/pull', methods=['GET'])
def sync_pull():
    """拉取云端数据到本地"""
    client_id = request.args.get('client_id', 'unknown')

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM accounts WHERE is_deleted = 0")
    accounts = cursor.fetchall()

    cursor.execute("""
        SELECT t.*, a.name as account_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.is_deleted = 0
        ORDER BY t.created_at DESC
    """)
    transactions = cursor.fetchall()

    cursor.execute("""
        INSERT INTO sync_log (client_id, sync_type, data_type)
        VALUES (%s, 'pull', 'full')
    """, (client_id,))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({
        'success': True,
        'data': {
            'accounts': accounts,
            'transactions': transactions,
            'synced_at': datetime.now().isoformat()
        }
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({'status': 'ok', 'message': '服务正常运行'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
