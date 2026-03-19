# Snake AI — A* Pathfinding vs Q-Learning

A web-based Snake game where two AI algorithms compete head-to-head: a classic A* pathfinder and a Q-Learning reinforcement learning agent. Built with Flask on the backend and a vanilla JavaScript canvas frontend.

---

## Overview

This project serves as a practical comparison between a deterministic search algorithm and a learned policy. A* always finds the optimal path to food given the current board state, while the Q-Learning agent improves through trial and error across training episodes. The interface lets you watch either agent play, train the RL agent, and run statistical comparisons between the two.

---

## Features

- **A* Pathfinding** — Manhattan heuristic with flood-fill survival check to avoid self-trapping
- **Q-Learning RL** — Tabular Q-learning with epsilon-greedy exploration and epsilon decay
- **Interactive controls** — Step through moves manually or run at adjustable speed (1x to 10x)
- **Training panel** — Train the RL agent for 2000 episodes with a live progress bar and reward curve
- **Comparison mode** — Run 10 or 50 games per algorithm and view a statistical breakdown (avg score, max score, success rate, avg steps)
- **Persistent history** — Game scores are stored via TinyDB and reload on page refresh
- **Q-table persistence** — Trained Q-table is saved to disk and reloaded automatically between sessions

---

## Project Structure

```
SnakeGame/
├── snake_app/
│   ├── app.py                  # Flask routes and application entry point
│   ├── requirements.txt
│   ├── backend/
│   │   ├── game.py             # Snake game logic and state management
│   │   ├── astar.py            # A* pathfinder with flood-fill safety check
│   │   ├── rl_qlearning.py     # Q-Learning agent, training loop, Q-table I/O
│   │   ├── stats.py            # Comparison runner and statistics manager
│   │   └── db.py               # TinyDB persistence layer
│   ├── static/
│   │   ├── main.js             # Frontend game loop, canvas rendering, UI
│   │   └── style.css
│   ├── templates/
│   │   └── index.html
│   └── tests/
│       ├── test_game.py
│       ├── test_astar.py
│       └── test_rl.py
```

---

## Getting Started

### Prerequisites

- Python 3.9 or higher

### Installation

```bash
git clone https://github.com/habibabnk/Snakegame.git
cd Snakegame/snake_app
pip install -r requirements.txt
```

### Running the App

```bash
python app.py
```

Open your browser and navigate to `http://127.0.0.1:5000`.

---

## How It Works

### A* Pathfinding

The A* agent computes the shortest path to the food on every step using Manhattan distance as the heuristic. Before committing to that path, it runs a flood-fill simulation to check that eating the food will still leave the snake with sufficient reachable space (at least 30% of free cells). If the path is unsafe, it falls back to a tail-chase strategy, then a pure flood-fill survival move.

### Q-Learning Agent

The state is represented as a tuple of:
- Relative food position from the snake's head (dx, dy)
- Four binary danger flags — whether the next cell in each direction is blocked

The agent uses an epsilon-greedy policy during training, starting at full exploration and decaying epsilon over episodes. Rewards: +50 for eating food, -100 for game over, +1/-1 for moving closer/further from food. The Q-table is serialized to `q_table.json` after each training run and reloaded automatically on startup.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reset` | Initialize a new game |
| POST | `/api/step` | Advance the game by one move |
| POST | `/api/run` | Run the game for up to N steps |
| POST | `/api/train` | Train the RL agent for N episodes |
| POST | `/api/compare` | Run a head-to-head comparison |
| GET | `/api/history` | Retrieve score history from the database |
| POST | `/api/clear` | Clear all stored game results |

---

## Running Tests

```bash
cd snake_app
pytest tests/
```

---

## Tech Stack

- **Backend** — Python, Flask, TinyDB
- **Frontend** — Vanilla JavaScript, HTML5 Canvas
- **Algorithms** — A* search, Tabular Q-Learning
