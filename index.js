require('dotenv').config(); // Load environment variables
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const mysql = require('mysql');
const path = require('path');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Create MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Check if the "news" table exists, create it if not
db.query('CREATE TABLE IF NOT EXISTS news (' +
    'id INT AUTO_INCREMENT PRIMARY KEY,' +
    'title VARCHAR(255) NOT NULL,' +
    'content TEXT NOT NULL,' +
    'imageUrl VARCHAR(255)' +
    ')', (err) => {
        if (err) {
            console.error('Error creating news table:', err);
        }
    });

// Middleware for session management
app.use(session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true
}));

const requireLogin = (req, res, next) => {
    if (req.session && req.session.user === 'admin') {
        next();
    } else {
        res.redirect('/login');
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, 'newsImage-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

app.get('/', (req, res) => {
    // Fetch the latest news from the database based on the last two IDs
    db.query('SELECT * FROM news ORDER BY id DESC LIMIT 4', (err, newsRows) => {
        if (err) {
            console.error('Error fetching latest news:', err);
            res.render('index', { newsList: [], user: req.session.user });
            return;
        }

        // Pass the fetched news data along with the user session information to the template
        res.render('index', { newsList: newsRows, user: req.session.user });
    });
});
app.get('/news/:id', (req, res) => {
    const newsId = req.params.id;

    // Fetch the news article from the database based on its ID
    db.query('SELECT * FROM news WHERE id = ?', [newsId], (err, newsRow) => {
        if (err) {
            console.error('Error fetching news article:', err);
            // Handle error
            return;
        }

        // Render the news article EJS template with the retrieved news data
        res.render('news-article', { news: newsRow[0] }); // Assuming only one news article is returned
    });
});

app.get('/news', (req, res) => {
    const sql = 'SELECT * FROM news';
    db.query(sql, (err, rows) => {
        if (err) {
            console.error('Error fetching news:', err);
            res.redirect('/news'); // Handle error as needed
            return;
        }
        res.render('news', { newsList: rows, user: req.session.user });
    });
});
app.get('/search', (req, res) => {
    const query = req.query.query; // Get the search query from the URL parameter
    const sql = 'SELECT * FROM news WHERE title LIKE ? OR content LIKE ?';
    const searchTerm = `%${query}%`; // Add wildcard characters to search for partial matches
    db.query(sql, [searchTerm, searchTerm], (err, rows) => {
        if (err) {
            console.error('Error searching news:', err);
            res.redirect('/news'); // Handle error as needed
            return;
        }
        res.render('search-results', { searchQuery: query, searchResults: rows, user: req.session.user });
    });
});

app.get('/login', (req, res) => {
    res.render('login', { user: req.session.user });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin1234') {
        req.session.user = 'admin';
        res.redirect('/admin');
    } else {
        res.redirect('/news');
    }
});

app.get('/admin', requireLogin, (req, res) => {
    const sql = 'SELECT * FROM news';
    db.query(sql, (err, rows) => {
        if (err) {
            console.error('Error fetching news:', err);
            res.redirect('/admin'); // Handle error as needed
            return;
        }
        res.render('admin', { newsList: rows, user: req.session.user });
    });
});

app.post('/admin/add-news', requireLogin, upload.single('newsImage'), (req, res) => {
    const { newsTitle, newsContent } = req.body;
    const imageUrl = req.file ? '/uploads/' + req.file.filename : '';

    const sql = 'INSERT INTO news (title, content, imageUrl) VALUES (?, ?, ?)';
    db.query(sql, [newsTitle, newsContent, imageUrl], (err, result) => {
        if (err) {
            console.error('Error adding news:', err);
            res.redirect('/admin'); // Handle error as needed
            return;
        }
        res.redirect('/admin');
    });
});
// Express route for deleting a news article
// Express route for deleting a news article by ID
app.post('/admin/delete-news/:id', requireLogin, (req, res) => {
    const newsId = req.params.id; // Extract news article ID from URL parameter

    // Perform delete operation in the database using the newsId
    db.query('DELETE FROM news WHERE id = ?', [newsId], (err, result) => {
        if (err) {
            console.error('Error deleting news article:', err);
            res.status(500).send('Error deleting news article');
        } else {
            console.log('News article deleted successfully');
            res.redirect('/admin'); // Redirect to admin page after successful delete
        }
    });
});




app.post('/admin/update-news', requireLogin, (req, res) => {
    const { newsId, updatedTitle, updatedContent } = req.body;
    const sql = 'UPDATE news SET title = ?, content = ? WHERE id = ?';
    db.query(sql, [updatedTitle, updatedContent, newsId], (err, result) => {
        if (err) {
            console.error('Error updating news:', err);
            res.redirect('/admin'); // Handle error as needed
            return;
        }
        res.redirect('/admin');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});




app.listen(port, () => {
    
    console.log(`Server is running at http://localhost:${port}`);
});
    

