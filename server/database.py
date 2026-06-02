import pymysql
from dotenv import load_dotenv
import os

load_dotenv()

def get_connection():
    return pymysql.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'accounting'),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

def init_database():
    """初始化数据库"""
    # 连接MySQL服务器（不指定数据库）
    conn = pymysql.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    cursor = conn.cursor()

    # 创建数据库
    cursor.execute("CREATE DATABASE IF NOT EXISTS accounting CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    cursor.execute("USE accounting")

    # 创建账户表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(50) NOT NULL,
            balance DECIMAL(15,2) DEFAULT 0.00,
            remark TEXT,
            currency VARCHAR(20) DEFAULT '人民币',
            scope VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT DEFAULT 0
        )
    """)

    # 创建记账记录表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id VARCHAR(50) PRIMARY KEY,
            account_id VARCHAR(50) NOT NULL,
            category VARCHAR(20) NOT NULL,
            type VARCHAR(50),
            amount DECIMAL(15,2) NOT NULL,
            currency VARCHAR(20) DEFAULT 'CNY',
            unit VARCHAR(100),
            remark TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT DEFAULT 0,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
    """)

    # 创建同步日志表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id VARCHAR(100),
            sync_type VARCHAR(20),
            data_type VARCHAR(20),
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    cursor.close()
    conn.close()
    print("数据库初始化完成！")
