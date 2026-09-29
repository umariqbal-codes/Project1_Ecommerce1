# CodeAlpha Project 1 — Simple E-commerce Store

A complete beginner-friendly full-stack e-commerce project built for the CodeAlpha Full Stack Development internship.

🛒 CodeAlpha Project 1 — E-Commerce Store

A full-stack e-commerce web application
built during the CodeAlpha Full Stack Development Internship.

🌐 Live Demo: 
🎥 Video Demo:
💻 GitHub:

## Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Node.js + Express.js
- Database: SQLite
- Authentication: bcryptjs + JWT
- API: REST

## Features

- Product listing
- Product details
- Search and category filtering
- Shopping cart
- User registration and login
- Persistent user/product/order database
- Checkout and order processing
- Order history
- Responsive UI
- Protected order endpoints
- Input validation and basic error handling

## Folder structure

```text
CodeAlpha_Project1_Ecommerce/
├── backend/
│   ├── data/
│   ├── middleware/
│   │   └── auth.js
│   ├── db.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── product.html
│   ├── cart.html
│   ├── login.html
│   ├── register.html
│   ├── orders.html
│   ├── styles.css
│   └── app.js
└── README.md
```

## Requirements

- Node.js 18+ recommended
- npm

The Express server serves the frontend automatically.

## Demo account

The database is seeded automatically with products. For a fresh install, create your own account from the Register page.

## API overview

### Public

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/auth/register`
- `POST /api/auth/login`

### Authenticated

- `GET /api/auth/me`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`

## Notes

- This is an internship/learning project, not a production payment system.
- Payment is simulated; no real card details are collected.
- The SQLite database file is created automatically at `backend/data/shop.db`.
- Product images use remote Unsplash URLs. Internet access is needed for those images; the store still works if an image is unavailable.

CODEALPHA PROJECT 1
│
├── 💻 GitHub
│ └── CodeAlpha_Project1_Ecommerce
│
├── 🌐 Live Demo
│ └── your-project.onrender.com
│
├── 🎥 LinkedIn Video
│ └── 2–4 min explanation
│
└── 📝 LinkedIn Post
├── Project description
├── Tech stack
├── GitHub link
├── Live link
└── Screenshots
