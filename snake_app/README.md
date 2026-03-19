# Snake Game AI Comparison

A Flask web application comparing A* pathfinding and Q-Learning reinforcement learning for the classic Snake game.

## Project Overview

This project implements and compares two different AI approaches for playing Snake:
- **A* Pathfinding Algorithm** - Optimal pathfinding with heuristic search
- **Q-Learning Reinforcement Learning** - Learning through trial and error

## Architecture

The application uses a lightweight client–server architecture:
- **Backend (Python + Flask)**: Game logic, algorithms, and statistics
- **Frontend (HTML + JavaScript + Canvas)**: Visualization, controls, and metrics display

## File Structure

```
snake_app/
├── app.py                 # Flask web application and API endpoints
├── requirements.txt       # Python dependencies
├── README.md             # This documentation
├── backend/
│   ├── __init__.py       # Backend module initialization
│   ├── game.py           # Game logic and state management
│   ├── astar.py          # A* pathfinding algorithm
│   ├── rl_qlearning.py   # Q-Learning reinforcement learning
│   └── stats.py          # Statistics and comparison module
├── templates/
│   └── index.html        # Frontend HTML template
├── static/
│   ├── main.js           # Frontend JavaScript logic
│   └── style.css         # Frontend styles
└── tests/
    ├── test_game.py      # Game logic unit tests
    ├── test_astar.py     # A* algorithm unit tests
    └── test_rl.py        # Q-Learning unit tests
```

## Installation

1. **Clone or download the project**
2. **Create a virtual environment** (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

## Running the Application

1. **Start the Flask server**:
```bash
python app.py
```

2. **Open your web browser** and navigate to:
```
http://127.0.0.1:5000
```

## Features

### Game Controls
- **Algorithm Selection**: Choose between A* and Q-Learning
- **Game Controls**: Reset, Step, Run, Stop
- **Training**: Train Q-Learning agent (500 episodes)
- **Comparison**: Run automated comparisons (10 or 50 games)

### Real-time Visualization
- **Canvas Rendering**: 10×10 grid with snake and food
- **Live Updates**: Real-time game state updates
- **Performance Metrics**: Score, steps, time, status

### Performance Comparison
- **Automated Testing**: Multiple games for statistical analysis
- **Detailed Metrics**: Average score, success rate, efficiency
- **Visual Results**: Winner highlighting and comparison table

## Algorithm Details

### A* Pathfinding
- **Heuristic**: Manhattan distance
- **Path Optimization**: Finds shortest path to food
- **Fallback Strategy**: Safest move when no path exists
- **Advantages**: Optimal, consistent, no training required
- **Disadvantages**: Higher computation per move

### Q-Learning
- **State Representation**: Relative food position + danger detection
- **Reward System**: +50 for food, -100 for death, ±1 for distance
- **Learning Parameters**: α=0.1, γ=0.95, ε=0.1 (decays over time)
- **Training**: Tabular Q-learning with persistent storage
- **Advantages**: Learns from experience, faster decisions after training
- **Disadvantages**: Requires training, performance varies

## API Endpoints

### Game Management
- `POST /api/reset` - Reset game and return initial state
- `POST /api/step` - Perform one step with selected strategy
- `POST /api/run` - Run continuously for X steps or until game over

### AI Training
- `POST /api/train` - Train Q-learning agent

### Comparison
- `POST /api/compare` - Run N games for each strategy
- `GET /api/stats` - Get current statistics
- `GET /api/results` - Export all results as JSON

## Testing

Run the unit tests to verify functionality:

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_game.py
pytest tests/test_astar.py
pytest tests/test_rl.py

# Run with verbose output
pytest -v
```

## Usage Instructions

### Playing with A*
1. Select "A* Pathfinding" from dropdown
2. Click "Reset Game" to start
3. Click "Step" for single moves or "Run" for continuous play
4. Watch the AI find optimal paths to food

### Playing with Q-Learning
1. Select "Q-Learning" from dropdown
2. Click "Train RL" to train the agent (recommended)
3. Click "Reset Game" to start
4. Click "Step" or "Run" to watch the trained agent play

### Running Comparisons
1. Click "Compare (10 games)" for quick comparison
2. Click "Compare (50 games)" for detailed analysis
3. View results in the comparison table

## Performance Metrics

### Real-time Display
- **Score**: Food collected
- **Steps**: Total moves made
- **Time**: Game duration
- **Status**: Current game state

### Comparison Analysis
- **Average Score**: Mean performance across games
- **Success Rate**: Games achieving score > 3
- **Efficiency**: Average steps per game
- **Winner Determination**: Algorithm with better average score

## Technical Specifications

- **Grid Size**: 10×10
- **Execution**: Local only (localhost:5000)
- **Reinforcement Learning**: Tabular Q-learning (no deep learning)
- **Dependencies**: Flask, NumPy, Pytest
- **Python Version**: 3.7+

## Expected Results

### A* Algorithm
- **Higher average scores** due to optimal pathfinding
- **More consistent performance** across games
- **Immediate performance** (no training required)

### Q-Learning
- **Variable performance** based on training quality
- **Improvement over time** with more training
- **Faster decision making** after sufficient training

## Troubleshooting

### Common Issues
1. **Port 5000 in use**: Change port in `app.py`
2. **Training slow**: Reduce episode count in train function
3. **Q-learning poor performance**: Increase training episodes

### Development Tips
- Use `pytest` to run tests during development
- Check browser console for JavaScript errors
- Monitor Flask logs for API issues

## Educational Value

This project demonstrates:
- **Pathfinding algorithms** (A*)
- **Reinforcement learning** (Q-Learning)
- **Web development** (Flask + JavaScript)
- **API design** (REST endpoints)
- **Algorithm comparison** methodology
- **Unit testing** practices

## Future Enhancements

1. **Advanced Algorithms**: Add more AI approaches (DQN, genetic algorithms)
2. **Hyperparameter Tuning**: Adjustable RL parameters
3. **Visualization Enhancements**: Path highlighting, decision trees
4. **Performance Analysis**: More detailed metrics and graphs
5. **Multi-grid Support**: Configurable board sizes

## Author

Project developed for AI algorithm comparison study.
Resource: Yu Li

## License

This project is for educational purposes.
