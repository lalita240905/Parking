const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.registerUser = async (username, password, role = 'user') => {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
        throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Passing role to our mock DB
    const [result] = await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role]);
    return result.insertId;
};

exports.loginUser = async (username, password) => {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    
    let user;
    if (rows.length === 0) {
        // Auto-register the user if they don't exist (Simple Login)
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, 'admin']);
        const [newRows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        user = newRows[0];
    } else {
        user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error('Invalid username or password');
        }
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role }, 
        process.env.JWT_SECRET || 'super_secret', 
        { expiresIn: '24h' }
    );
    
    return { token, username: user.username, role: user.role };
};
