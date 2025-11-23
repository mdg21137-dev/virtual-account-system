// server.js - 가상계좌 관리 시스템 백엔드 서버
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // Render 환경 변수 지원

// 미들웨어
app.use(cors()); // 모든 도메인에서 접근 허용
app.use(express.json());
app.use(express.static('public')); // 정적 파일 제공

// SQLite 데이터베이스 연결
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('데이터베이스 연결 오류:', err.message);
    } else {
        console.log('✅ SQLite 데이터베이스 연결 성공');
        initDatabase();
    }
});

// 데이터베이스 초기화
function initDatabase() {
    // 사용자 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            name TEXT,
            phone TEXT,
            role TEXT NOT NULL,
            createdAt TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('users 테이블 생성 오류:', err.message);
        } else {
            console.log('✅ users 테이블 준비 완료');
            
            // 기본 관리자 계정 생성
            db.get("SELECT * FROM users WHERE id = 'admin'", (err, row) => {
                if (!row) {
                    db.run(`
                        INSERT INTO users (id, password, role, createdAt) 
                        VALUES ('admin', 'admin123', 'admin', datetime('now', 'localtime'))
                    `, (err) => {
                        if (err) {
                            console.error('기본 관리자 계정 생성 오류:', err.message);
                        } else {
                            console.log('✅ 기본 관리자 계정 생성 (admin/admin123)');
                        }
                    });
                }
            });
        }
    });

    // 신청 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS applications (
            appNo TEXT PRIMARY KEY,
            customerId TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            officer TEXT,
            bank TEXT NOT NULL,
            amount INTEGER NOT NULL,
            purpose TEXT,
            status TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            source TEXT,
            deviceType TEXT,
            authCode TEXT,
            customerAuthCode TEXT,
            authVerified INTEGER DEFAULT 0,
            virtualAccount TEXT,
            bankName TEXT,
            accountHolder TEXT,
            FOREIGN KEY (customerId) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('applications 테이블 생성 오류:', err.message);
        } else {
            console.log('✅ applications 테이블 준비 완료');
        }
    });
}

// ===== API 엔드포인트 =====

// 로그인
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get(
        'SELECT * FROM users WHERE id = ? AND password = ?',
        [username, password],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: '서버 오류' });
            }
            if (!user) {
                return res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다' });
            }
            res.json({ 
                success: true, 
                user: { 
                    customerId: user.id, 
                    name: user.name || user.id,
                    phone: user.phone || '',
                    role: user.role 
                }
            });
        }
    );
});

// 회원가입
app.post('/api/register', (req, res) => {
    const { username, password, name, role } = req.body;
    
    if (!username || !password || !name) {
        return res.status(400).json({ error: '모든 필드를 입력하세요' });
    }
    
    if (username.length < 4 || password.length < 4) {
        return res.status(400).json({ error: '아이디와 비밀번호는 4자 이상이어야 합니다' });
    }
    
    db.run(
        `INSERT INTO users (id, password, name, phone, role, createdAt) 
         VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
        [username, password, name, '', role || 'customer'],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: '이미 존재하는 아이디입니다' });
                }
                return res.status(500).json({ error: '서버 오류: ' + err.message });
            }
            res.json({ success: true, id: username });
        }
    );
});

// 모든 사용자 조회
app.get('/api/users', (req, res) => {
    db.all('SELECT id as customerId, name, phone, role, createdAt FROM users', [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: '서버 오류' });
        }
        res.json(users);
    });
});

// 사용자 생성
app.post('/api/users', (req, res) => {
    const { id, password, role } = req.body;
    
    if (!id || !password) {
        return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요' });
    }

    db.run(
        `INSERT INTO users (id, password, role, createdAt) 
         VALUES (?, ?, ?, datetime('now', 'localtime'))`,
        [id, password, role || 'customer'],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: '이미 존재하는 아이디입니다' });
                }
                return res.status(500).json({ error: '서버 오류' });
            }
            res.json({ success: true, id });
        }
    );
});

// 사용자 삭제
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    
    if (id === 'admin') {
        return res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다' });
    }

    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: '서버 오류' });
        }
        res.json({ success: true });
    });
});

// 모든 신청 조회
app.get('/api/applications', (req, res) => {
    db.all('SELECT * FROM applications ORDER BY createdAt DESC', [], (err, applications) => {
        if (err) {
            return res.status(500).json({ error: '서버 오류' });
        }
        
        // authVerified를 boolean으로 변환
        const formattedApps = applications.map(app => ({
            ...app,
            authVerified: app.authVerified === 1
        }));
        
        res.json(formattedApps);
    });
});

// 특정 사용자 신청 조회
app.get('/api/applications/user/:customerId', (req, res) => {
    const { customerId } = req.params;
    
    db.all(
        'SELECT * FROM applications WHERE customerId = ? ORDER BY createdAt DESC',
        [customerId],
        (err, applications) => {
            if (err) {
                return res.status(500).json({ error: '서버 오류' });
            }
            
            const formattedApps = applications.map(app => ({
                ...app,
                authVerified: app.authVerified === 1
            }));
            
            res.json(formattedApps);
        }
    );
});

// 신청 생성
app.post('/api/applications', (req, res) => {
    const {
        appNo, customerId, name, phone, officer, bank, amount, purpose,
        status, createdAt, source, deviceType
    } = req.body;

    db.run(
        `INSERT INTO applications (
            appNo, customerId, name, phone, officer, bank, amount, purpose,
            status, createdAt, source, deviceType, authVerified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [appNo, customerId, name, phone, officer, bank, amount, purpose,
         status, createdAt, source, deviceType],
        function(err) {
            if (err) {
                console.error('신청 생성 오류:', err.message);
                return res.status(500).json({ error: '서버 오류' });
            }
            res.json({ success: true, appNo });
        }
    );
});

// 신청 수정
app.put('/api/applications/:appNo', (req, res) => {
    const { appNo } = req.params;
    const updates = req.body;
    
    // 업데이트할 필드 동적 생성
    const fields = Object.keys(updates);
    const setClause = fields.map(field => {
        if (field === 'authVerified') {
            return `${field} = ?`;
        }
        return `${field} = ?`;
    }).join(', ');
    
    const values = fields.map(field => {
        if (field === 'authVerified') {
            return updates[field] ? 1 : 0;
        }
        return updates[field];
    });
    values.push(appNo);

    db.run(
        `UPDATE applications SET ${setClause} WHERE appNo = ?`,
        values,
        function(err) {
            if (err) {
                console.error('신청 수정 오류:', err.message);
                return res.status(500).json({ error: '서버 오류' });
            }
            res.json({ success: true });
        }
    );
});

// 신청 삭제
app.delete('/api/applications/:appNo', (req, res) => {
    const { appNo } = req.params;
    
    db.run('DELETE FROM applications WHERE appNo = ?', [appNo], function(err) {
        if (err) {
            return res.status(500).json({ error: '서버 오류' });
        }
        res.json({ success: true });
    });
});

// 통계 조회
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    db.get('SELECT COUNT(*) as total FROM applications', [], (err, row) => {
        if (err) return res.status(500).json({ error: '서버 오류' });
        stats.total = row.total;
        
        db.get('SELECT COUNT(*) as pending FROM applications WHERE status = "대기"', [], (err, row) => {
            if (err) return res.status(500).json({ error: '서버 오류' });
            stats.pending = row.pending;
            
            db.get('SELECT COUNT(*) as approved FROM applications WHERE status = "승인"', [], (err, row) => {
                if (err) return res.status(500).json({ error: '서버 오류' });
                stats.approved = row.approved;
                
                db.get('SELECT COUNT(*) as verified FROM applications WHERE customerAuthCode IS NOT NULL AND status = "승인"', [], (err, row) => {
                    if (err) return res.status(500).json({ error: '서버 오류' });
                    stats.verified = row.verified;
                    
                    res.json(stats);
                });
            });
        });
    });
});

// 기기별 통계 조회
app.get('/api/stats/devices', (req, res) => {
    db.all(
        `SELECT deviceType, COUNT(*) as count 
         FROM applications 
         WHERE deviceType IS NOT NULL 
         GROUP BY deviceType`,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: '서버 오류' });
            }
            res.json(rows);
        }
    );
});

// 출처별 통계 조회
app.get('/api/stats/sources', (req, res) => {
    db.all(
        `SELECT source, COUNT(*) as count 
         FROM applications 
         WHERE source IS NOT NULL 
         GROUP BY source`,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: '서버 오류' });
            }
            res.json(rows);
        }
    );
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('🚀 가상계좌 관리 시스템 서버 시작');
    console.log('='.repeat(50));
    console.log(`📡 서버 주소: http://localhost:${PORT}`);
    console.log(`📊 데이터베이스: SQLite (database.db)`);
    console.log(`👤 기본 관리자: admin / admin123`);
    console.log('='.repeat(50));
});

// 프로세스 종료 시 DB 연결 종료
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('데이터베이스 종료 오류:', err.message);
        } else {
            console.log('✅ 데이터베이스 연결 종료');
        }
        process.exit(0);
    });
});
