"""
Persistent storage module using TinyDB.
Stores game results and training history across sessions.
"""

from tinydb import TinyDB, Query
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'game_history.json')


class GameDB:
    def __init__(self):
        self.db = TinyDB(DB_PATH)
        self.games = self.db.table('games')
        self.training = self.db.table('training')

    def save_game(self, algorithm: str, score: int, steps: int,
                  time_taken: float, game_over: bool) -> None:
        self.games.insert({
            'algorithm': algorithm,
            'score': score,
            'steps': steps,
            'time_taken': round(time_taken, 3),
            'game_over': game_over,
            'success': score > 3,
            'timestamp': datetime.now().isoformat()
        })

    def save_training_run(self, episodes: int, training_time: float,
                          final_epsilon: float, history: list) -> None:
        self.training.insert({
            'episodes': episodes,
            'training_time': round(training_time, 2),
            'final_epsilon': round(final_epsilon, 4),
            'history': history,
            'timestamp': datetime.now().isoformat()
        })

    def get_score_history(self, algorithm: str = None, limit: int = 50) -> list:
        """Get recent scores for chart display."""
        G = Query()
        if algorithm:
            results = self.games.search(G.algorithm == algorithm)
        else:
            results = self.games.all()
        # Sort by timestamp descending, take last `limit`
        results.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        results = results[:limit]
        results.reverse()
        return [{'score': r['score'], 'algorithm': r['algorithm'],
                 'timestamp': r.get('timestamp', '')} for r in results]

    def get_stats_summary(self, algorithm: str) -> dict:
        """Get aggregate stats for an algorithm."""
        G = Query()
        results = self.games.search(G.algorithm == algorithm)
        if not results:
            return {}
        scores = [r['score'] for r in results]
        return {
            'total_games': len(results),
            'avg_score': round(sum(scores) / len(scores), 2),
            'max_score': max(scores),
            'best_session': max(scores),
        }

    def get_all_history(self) -> dict:
        return {
            'games': self.games.all(),
            'training': self.training.all()
        }

    def clear_games(self) -> None:
        self.games.truncate()

    def get_last_training(self) -> dict:
        runs = self.training.all()
        if not runs:
            return {}
        runs.sort(key=lambda x: x.get('timestamp', ''))
        return runs[-1]


# Singleton
_db = None

def get_db() -> GameDB:
    global _db
    if _db is None:
        _db = GameDB()
    return _db
