# 🗺️ Dadream CRM (다드림 영업관리)

Dadream CRM is a Location-Based Sales Management System built for field sales teams. It visualizes sales activities, client locations, and movement paths on an interactive map, providing a seamless mobile-first experience.

## 🚀 Key Features

### 📍 Map & Visualization
- **Naver Map Integration**: High-precision Korean map data via Naver Maps API v3.
- **Dynamic Pins**: Color-coded pins (Blue=Active, Red=Unassigned) representing client sites.
- **Activity Path**: Visualizes the daily route of sales representatives with numbered markers and connecting lines.
- **Event-Driven Rendering**: Ensures pins are only drawn after data is fully loaded (`dadream-data-loaded` event), preventing race conditions.

### 👥 Sales Management
- **Contact Management**: Assign clients to specific sales reps.
- **Pin Management**: Create, edit, and complete sales sites. Upload verification photos directly from the field.
- **Phone Constraints**: Enforces data integrity with unique phone number constraints per representative.

### 🛡️ System & Security
- **Supabase Backend**: Real-time database using PostgreSQL.
- **Fast Auth**: Optimistic session restoration for instant startup (no "DB Timeout" delays).
- **Secure Schema**: RLS (Row Level Security) and strict Foreign Key constraints.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES Module), CSS3 (Glassmorphism Design), HTML5
- **Build Tool**: Vite
- **Maps**: Naver Maps JavaScript API v3
- **Backend/DB**: Supabase (PostgreSQL, Auth, Storage)

---

## ⚙️ Setup & Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-repo/dadream-app.git
    cd dadream-app
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Variables**
    Create a `.env` file in the root directory:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    # Note: Naver Client ID is injected in index.html
    ```

4.  **Run Locally**
    ```bash
    npm run dev
    ```

---

## 📂 Project Structure

```
/
├── index.html          # Entry point (injected with Naver Map ID)
├── app.js              # Main Application Controller
├── store.js            # State Management & Data Layer (Broadcaster)
├── map_renderer.js     # Naver Map Wrapper Class
├── style.css           # Global Styles
└── src/
    └── components/
        ├── Auth/       # Authentication Logic
        ├── Pin/        # Pin Management (PinManager listeners)
        ├── Admin/      # Admin History & Stats
        └── ...
```

---

## 💡 Recent Key Updates

- **Schema Sync**: Aligned Database Schema with Code logic (added `created_at`, cleaned unused columns).
- **Performance**: Reduced startup time by moving session verification to background.
- **Stability**: Implemented "So-Mun-Na-Gi" (Event-Driven) pattern to synchronize Map rendering with Supabase data loading.

---

© 2026 Dadream CRM Team
