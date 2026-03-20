# Snake AI — A* Pathfinding vs Q-Learning

A web-based Snake game where two AI algorithms compete side by side: a classic A* pathfinder and a Q-Learning reinforcement learning agent. Built with Flask and vanilla JavaScript, with a real-time visualization dashboard.

---

## Overview

This project compares a deterministic search algorithm against a learned policy. A* always finds the optimal path to food given the current board state. The Q-Learning agent improves through trial and error across training episodes. The interface lets you watch either agent play, train the RL agent, and run automated statistical comparisons between the two.

---

## Features

- **A* Pathfinding** — Manhattan heuristic with flood-fill safety check to prevent self-trapping
- **Q-Learning Agent** — Tabular Q-learning with epsilon-greedy exploration and epsilon decay
- **Interactive controls** — Step through moves manually or run at adjustable speed (1x to 10x)
- **Training panel** — Train the RL agent for 2000 episodes with a live progress bar and reward curve
- **Comparison mode** — Run 10 or 50 games per algorithm and view a full statistical breakdown
- **Score history chart** — Tracks the last 20 games of the current session
- **Persistent storage** — Game results and training runs are saved via TinyDB across sessions
- **Q-table persistence** — Trained Q-table is saved to disk and reloaded automatically on startup

---

## Project Structure

```
SnakeGame/
└── snake_app/
    ├── app.py                  # Flask routes and application entry point
    ├── requirements.txt        # Python dependencies
    ├── game_history.json       # TinyDB persistent storage
    ├── q_table.json            # Saved Q-Learning policy
    ├── backend/
    │   ├── game.py             # Snake game logic and state management
    │   ├── astar.py            # A* pathfinder with flood-fill safety check
    │   ├── rl_qlearning.py     # Q-Learning agent, training loop, Q-table I/O
    │   ├── stats.py            # Comparison runner and statistics aggregation
    │   └── db.py               # TinyDB persistence layer
    ├── static/
    │   ├── main.js             # Frontend game loop, canvas rendering, UI
    │   └── style.css           # Application styles
    ├── templates/
    │   └── index.html          # Single-page application template
    └── tests/
        ├── test_game.py
        ├── test_astar.py
        └── test_rl.py
```

---

## Requirements

- Python 3.9 or higher
- pip

---

## Installation

**1. Clone the repository**

```bash
git clone https://github.com/habibabnk/Snakegame.git
cd Snakegame
```

**2. Create and activate a virtual environment**

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**3. Install dependencies**

```bash
pip install -r snake_app/requirements.txt
```

---

## Running the Application

```bash
python snake_app/app.py
```

Open your browser and go to `http://127.0.0.1:5000`.

---

## Controls

| Control | Description |
|---------|-------------|
| Algorithm dropdown | Switch between A* Pathfinding and Q-Learning |
| Reset | Reset the board for a new game |
| Step | Advance the game one move at a time |
| Run | Play the game automatically at the selected speed |
| Stop | Pause auto-play |
| Speed slider | Adjust playback speed (1x to 10x) |
| Train RL | Run 2000 training episodes and update the Q-table |
| Compare x10 | Run 10 games per algorithm and display a stats comparison |
| Compare x50 | Run 50 games per algorithm for a more thorough comparison |

---

## How It Works

### A* Pathfinding

The A* agent computes the shortest path to food on every move using Manhattan distance as the heuristic. Before committing to that path, a flood-fill simulation checks that eating the food leaves the snake with sufficient reachable space. If the path is unsafe, it falls back to tail-chasing, then a pure flood-fill survival move.

### Q-Learning Agent

State representation:
- Relative food position from the snake head (dx, dy)
- Four binary danger flags — whether the next cell in each cardinal direction is blocked

Training uses an epsilon-greedy policy starting at full exploration, with epsilon decaying over episodes. Rewards: +50 for eating food, -100 for game over, +1/-1 for moving closer or further from food. The Q-table is saved to `q_table.json` after each training run and reloaded automatically on startup.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reset` | Initialize a new game |
| POST | `/api/step` | Advance the game by one move |
| POST | `/api/train` | Train the RL agent for N episodes |
| POST | `/api/compare` | Run a head-to-head comparison |
| GET | `/api/history` | Retrieve score history from the database |
| POST | `/api/clear` | Clear all stored game results |

---

## Running Tests

```bash
python -m pytest snake_app/tests/
```

---

## Tech Stack

- **Backend** — Python, Flask, TinyDB
- **Frontend** — Vanilla JavaScript, HTML5 Canvas
- **Algorithms** — A* search, Tabular Q-Learning
