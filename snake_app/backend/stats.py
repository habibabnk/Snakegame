"""
Statistics and comparison module for Snake Game AI performance.
Computes metrics, stores results, and provides comparison analysis.
"""

import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from .game import SnakeGame
from .astar import AStarPathfinder
from .rl_qlearning import QLearningAgent
from .db import get_db


@dataclass
class GameResult:
    """Data class for storing single game results."""
    algorithm: str
    score: int
    steps: int
    time_taken: float
    game_over: bool
    success: bool  # Score > threshold
    avg_decision_time_ms: float = 0.0


class StatisticsManager:
    """
    Manages statistics and comparison for AI algorithms.
    Stores results, computes metrics, and provides analysis.
    """
    
    def __init__(self, success_threshold: int = 3):
        """
        Initialize statistics manager.
        
        Args:
            success_threshold: Minimum score to consider game successful
        """
        self.success_threshold = success_threshold
        self.results: Dict[str, List[GameResult]] = {
            'astar': [],
            'rl': []
        }
    
    def record_game_result(self, algorithm: str, score: int, steps: int,
                          time_taken: float, game_over: bool,
                          avg_decision_time_ms: float = 0.0) -> None:
        """
        Record result of a single game.

        Args:
            algorithm: Algorithm name ('astar' or 'rl')
            score: Final score
            steps: Total steps taken
            time_taken: Time taken in seconds
            game_over: Whether game ended due to collision
            avg_decision_time_ms: Average per-decision time in milliseconds
        """
        result = GameResult(
            algorithm=algorithm,
            score=score,
            steps=steps,
            time_taken=time_taken,
            game_over=game_over,
            success=score > self.success_threshold,
            avg_decision_time_ms=avg_decision_time_ms,
        )

        self.results[algorithm].append(result)
    
    def get_algorithm_stats(self, algorithm: str) -> Dict[str, float]:
        """
        Compute statistics for a specific algorithm.
        
        Args:
            algorithm: Algorithm name ('astar' or 'rl')
            
        Returns:
            Dictionary of computed statistics
        """
        if algorithm not in self.results or not self.results[algorithm]:
            return {}
        
        results = self.results[algorithm]
        scores = [r.score for r in results]
        steps = [r.steps for r in results]
        times = [r.time_taken for r in results]
        successes = [r.success for r in results]
        decision_times = [r.avg_decision_time_ms for r in results]

        return {
            'avg_score': sum(scores) / len(scores),
            'max_score': max(scores),
            'min_score': min(scores),
            'avg_steps': sum(steps) / len(steps),
            'avg_time': sum(times) / len(times),
            'success_rate': sum(successes) / len(successes) * 100,
            'total_games': len(results),
            'avg_decision_time_ms': round(sum(decision_times) / len(decision_times), 4),
        }
    
    def get_comparison_stats(self) -> Dict[str, Dict[str, float]]:
        """
        Get comparison statistics for all algorithms.
        
        Returns:
            Dictionary with stats for each algorithm
        """
        return {
            'astar': self.get_algorithm_stats('astar'),
            'rl': self.get_algorithm_stats('rl')
        }
    
    def run_comparison(self, num_games: int = 10, q_table: dict = None) -> Dict[str, Any]:
        """
        Run comparison test between algorithms.

        Args:
            num_games: Number of games to run for each algorithm
            q_table: Pre-trained Q-table to use (avoids retraining per game)

        Returns:
            Dictionary with comparison results
        """
        # Clear previous results
        self.results = {'astar': [], 'rl': []}
        db = get_db()

        # Test A* algorithm
        for i in range(num_games):
            game = SnakeGame()
            astar = AStarPathfinder(game)

            start_time = time.time()
            steps = 0
            max_steps = 300
            decision_times = []

            while not game.game_over and steps < max_steps:
                t0 = time.perf_counter()
                next_move = astar.get_next_move()
                t1 = time.perf_counter()
                decision_times.append((t1 - t0) * 1000)
                if next_move:
                    game.move_snake(next_move)
                else:
                    game.game_over = True
                    break
                steps += 1

            time_taken = time.time() - start_time
            avg_decision_ms = sum(decision_times) / len(decision_times) if decision_times else 0
            self.record_game_result('astar', game.score, steps, time_taken, game.game_over, avg_decision_ms)
            db.save_game(algorithm='astar', score=game.score, steps=steps,
                         time_taken=time_taken, game_over=game.game_over)

        # Build a single trained RL agent to reuse across all comparison games
        if q_table:
            trained_q_table = q_table
        else:
            ref_game = SnakeGame()
            ref_agent = QLearningAgent(ref_game)
            if not ref_agent.q_table:
                ref_agent.train(500)
            trained_q_table = ref_agent.q_table

        # Test Q-Learning algorithm
        for i in range(num_games):
            game = SnakeGame()
            rl_agent = QLearningAgent(game)
            rl_agent.q_table = trained_q_table

            start_time = time.time()
            steps = 0
            max_steps = 300
            decision_times = []

            while not game.game_over and steps < max_steps:
                t0 = time.perf_counter()
                next_move = rl_agent.get_next_move()
                t1 = time.perf_counter()
                decision_times.append((t1 - t0) * 1000)
                if next_move:
                    game.move_snake(next_move)
                else:
                    game.game_over = True
                    break
                steps += 1

            time_taken = time.time() - start_time
            avg_decision_ms = sum(decision_times) / len(decision_times) if decision_times else 0
            self.record_game_result('rl', game.score, steps, time_taken, game.game_over, avg_decision_ms)
            db.save_game(algorithm='rl', score=game.score, steps=steps,
                         time_taken=time_taken, game_over=game.game_over)

        return self.get_comparison_stats()
    
    def export_results(self) -> Dict[str, Any]:
        """
        Export all results as JSON-compatible dictionary.
        
        Returns:
            Dictionary with all results and statistics
        """
        export_data = {
            'results': {
                'astar': [
                    {
                        'score': r.score,
                        'steps': r.steps,
                        'time_taken': r.time_taken,
                        'game_over': r.game_over,
                        'success': r.success
                    } for r in self.results['astar']
                ],
                'rl': [
                    {
                        'score': r.score,
                        'steps': r.steps,
                        'time_taken': r.time_taken,
                        'game_over': r.game_over,
                        'success': r.success
                    } for r in self.results['rl']
                ]
            },
            'statistics': self.get_comparison_stats()
        }
        
        return export_data
    
    def clear_results(self) -> None:
        """Clear all stored results."""
        self.results = {'astar': [], 'rl': []}
    
    def get_winner(self) -> Optional[str]:
        """
        Determine which algorithm performed better based on average score.
        
        Returns:
            Winning algorithm name, or None if no results
        """
        stats = self.get_comparison_stats()
        
        if not stats['astar'] or not stats['rl']:
            return None
        
        astar_avg = stats['astar']['avg_score']
        rl_avg = stats['rl']['avg_score']
        
        return 'astar' if astar_avg > rl_avg else 'rl'
    
    def print_summary(self) -> None:
        """Print a summary of comparison results."""
        stats = self.get_comparison_stats()
        
        print("\n" + "="*50)
        print("ALGORITHM COMPARISON SUMMARY")
        print("="*50)
        
        for algorithm in ['astar', 'rl']:
            if stats[algorithm]:
                name = algorithm.upper()
                s = stats[algorithm]
                print(f"\n{name} ALGORITHM:")
                print(f"  Average Score: {s['avg_score']:.2f}")
                print(f"  Max Score: {s['max_score']}")
                print(f"  Min Score: {s['min_score']}")
                print(f"  Average Steps: {s['avg_steps']:.1f}")
                print(f"  Average Time: {s['avg_time']:.3f}s")
                print(f"  Success Rate: {s['success_rate']:.1f}%")
                print(f"  Total Games: {s['total_games']}")
        
        winner = self.get_winner()
        if winner:
            print(f"\nWINNER: {winner.upper()}")
        
        print("="*50)
