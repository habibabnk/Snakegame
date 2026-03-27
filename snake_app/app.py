"""
Flask web application for Snake Game AI comparison.
"""

from flask import Flask, render_template, jsonify, request
import time
from backend.game import SnakeGame, Direction
from backend.astar import AStarPathfinder
from backend.rl_qlearning import QLearningAgent
from backend.stats import StatisticsManager
from backend.db import get_db

app = Flask(__name__)

games = {}
astar_agents = {}
rl_agents = {}
stats_manager = StatisticsManager()

# Global shared trained Q-table (persists across game resets within session)
_shared_q_table = {}
_shared_training_episodes = 0
_shared_epsilon = 1.0

# Race mode dedicated game instances
_race_games = {}
_race_agents = {}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/reset', methods=['POST'])
def reset_game():
    global _shared_q_table, _shared_training_episodes, _shared_epsilon
    data = request.get_json()
    game_id = data.get('game_id', 'default')
    algorithm = data.get('algorithm', 'astar')

    games[game_id] = SnakeGame()

    if algorithm == 'astar':
        astar_agents[game_id] = AStarPathfinder(games[game_id])
    elif algorithm == 'rl':
        agent = QLearningAgent(games[game_id])
        if _shared_q_table:
            agent.q_table = _shared_q_table
            agent.training_episodes = _shared_training_episodes
            agent.epsilon = _shared_epsilon
        rl_agents[game_id] = agent

    return jsonify(games[game_id].get_state())


@app.route('/api/step', methods=['POST'])
def step_game():
    data = request.get_json()
    game_id = data.get('game_id', 'default')
    algorithm = data.get('algorithm', 'astar')

    if game_id not in games:
        return jsonify({'error': 'Game not found'}), 404

    game = games[game_id]
    if game.game_over:
        return jsonify(game.get_state())

    start_time = time.perf_counter()
    next_move = None
    if algorithm == 'astar' and game_id in astar_agents:
        next_move = astar_agents[game_id].get_next_move()
    elif algorithm == 'rl' and game_id in rl_agents:
        next_move = rl_agents[game_id].get_next_move()
    decision_time_ms = (time.perf_counter() - start_time) * 1000

    if next_move:
        game.move_snake(next_move)
    elif not game.game_over:
        # No valid moves — snake is trapped, treat as game over
        game.game_over = True

    if game.game_over:
        get_db().save_game(
            algorithm=algorithm, score=game.score,
            steps=game.steps, time_taken=0, game_over=True
        )

    state = game.get_state()
    state['decision_time_ms'] = round(decision_time_ms, 3)
    return jsonify(state)


@app.route('/api/run', methods=['POST'])
def run_game():
    data = request.get_json()
    game_id = data.get('game_id', 'default')
    algorithm = data.get('algorithm', 'astar')
    max_steps = data.get('max_steps', 100)

    if game_id not in games:
        return jsonify({'error': 'Game not found'}), 404

    game = games[game_id]
    steps_taken = 0
    while not game.game_over and steps_taken < max_steps:
        next_move = None
        if algorithm == 'astar' and game_id in astar_agents:
            next_move = astar_agents[game_id].get_next_move()
        elif algorithm == 'rl' and game_id in rl_agents:
            next_move = rl_agents[game_id].get_next_move()
        if not next_move:
            game.game_over = True
            break
        game.move_snake(next_move)
        steps_taken += 1

    if game.game_over:
        get_db().save_game(
            algorithm=algorithm, score=game.score,
            steps=game.steps, time_taken=0, game_over=True
        )

    return jsonify({'state': game.get_state(), 'steps_taken': steps_taken})


@app.route('/api/train', methods=['POST'])
def train_rl():
    global _shared_q_table, _shared_training_episodes, _shared_epsilon

    data = request.get_json()
    episodes = data.get('episodes', 2000)

    temp_game = SnakeGame()
    temp_agent = QLearningAgent(temp_game)

    if _shared_q_table:
        temp_agent.q_table = _shared_q_table
        temp_agent.training_episodes = _shared_training_episodes
        temp_agent.epsilon = max(0.1, _shared_epsilon)

    start_time = time.time()
    history = temp_agent.train(episodes)
    training_time = round(time.time() - start_time, 2)

    _shared_q_table = temp_agent.q_table
    _shared_training_episodes = temp_agent.training_episodes
    _shared_epsilon = temp_agent.epsilon

    for agent in rl_agents.values():
        agent.q_table = temp_agent.q_table
        agent.training_episodes = temp_agent.training_episodes
        agent.epsilon = temp_agent.epsilon

    last_epsilon = history[-1]['epsilon'] if history else round(temp_agent.epsilon, 4)
    get_db().save_training_run(
        episodes=episodes,
        training_time=training_time,
        final_epsilon=last_epsilon,
        history=history
    )

    return jsonify({
        'status': 'training_complete',
        'episodes_trained': episodes,
        'total_episodes': temp_agent.training_episodes,
        'training_time': training_time,
        'final_epsilon': last_epsilon,
        'history': history
    })


@app.route('/api/compare', methods=['POST'])
def compare_algorithms():
    data = request.get_json()
    num_games = data.get('num_games', 10)
    stats = stats_manager.run_comparison(num_games, q_table=_shared_q_table or None)
    return jsonify({
        'astar': stats.get('astar', {}),
        'rl': stats.get('rl', {}),
        'statistics': stats,
        'winner': stats_manager.get_winner(),
        'num_games': num_games
    })


@app.route('/api/history', methods=['GET'])
def get_history():
    algorithm = request.args.get('algorithm', None)
    limit = int(request.args.get('limit', 50))
    db = get_db()
    return jsonify({
        'scores': db.get_score_history(algorithm=algorithm, limit=limit),
        'astar_summary': db.get_stats_summary('astar'),
        'rl_summary': db.get_stats_summary('rl'),
        'last_training': db.get_last_training()
    })


@app.route('/api/stats', methods=['GET'])
def get_stats():
    return jsonify(stats_manager.get_comparison_stats())


@app.route('/api/results', methods=['GET'])
def get_results():
    return jsonify(stats_manager.export_results())


@app.route('/api/clear', methods=['POST'])
def clear_results():
    stats_manager.clear_results()
    get_db().clear_games()
    return jsonify({'status': 'cleared'})


@app.route('/api/race/init', methods=['POST'])
def init_race():
    global _race_games, _race_agents
    _race_games['astar'] = SnakeGame()
    _race_games['rl'] = SnakeGame()
    _race_games['rl'].food = _race_games['astar'].food  # sync food for fairness

    _race_agents['astar'] = AStarPathfinder(_race_games['astar'])
    rl_agent = QLearningAgent(_race_games['rl'])
    if _shared_q_table:
        rl_agent.q_table = _shared_q_table
        rl_agent.training_episodes = _shared_training_episodes
        rl_agent.epsilon = _shared_epsilon
    _race_agents['rl'] = rl_agent

    return jsonify({
        'astar': _race_games['astar'].get_state(),
        'rl': _race_games['rl'].get_state()
    })


@app.route('/api/race/step', methods=['POST'])
def race_step():
    if not _race_games:
        return jsonify({'error': 'Race not initialized'}), 400

    results = {}
    for algo in ['astar', 'rl']:
        game = _race_games[algo]
        agent = _race_agents[algo]
        if not game.game_over:
            start = time.perf_counter()
            action = agent.get_next_move()
            decision_ms = (time.perf_counter() - start) * 1000
            if action:
                game.move_snake(action)
            elif not game.game_over:
                game.game_over = True
            if game.game_over:
                get_db().save_game(algorithm=algo, score=game.score,
                                   steps=game.steps, time_taken=0, game_over=True)
            state = game.get_state()
            state['decision_time_ms'] = round(decision_ms, 3)
            results[algo] = state
        else:
            results[algo] = game.get_state()

    astar_score = results['astar']['score']
    rl_score = results['rl']['score']
    if astar_score > rl_score:
        results['leader'] = 'astar'
    elif rl_score > astar_score:
        results['leader'] = 'rl'
    else:
        results['leader'] = 'tie'

    results['race_over'] = results['astar']['game_over'] and results['rl']['game_over']
    if results['race_over']:
        if astar_score > rl_score:
            results['winner'] = 'astar'
        elif rl_score > astar_score:
            results['winner'] = 'rl'
        else:
            results['winner'] = 'tie'

    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)