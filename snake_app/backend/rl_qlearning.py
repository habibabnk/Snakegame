"""
Q-Learning reinforcement learning module for Snake Game.
Implements tabular Q-learning with epsilon-greedy exploration.
"""

import random
import json
import os
from typing import Dict, Tuple, Optional, List
from .game import SnakeGame, Direction


class QLearningAgent:
    """
    Tabular Q-Learning agent for Snake Game.
    Learns optimal policy through trial and error.
    """
    
    def __init__(self, game: SnakeGame, learning_rate: float = 0.2,
                 discount_factor: float = 0.95, epsilon: float = 1.0):
        """
        Initialize Q-Learning agent.
        
        Args:
            game: SnakeGame instance
            learning_rate: Learning rate for Q-value updates
            discount_factor: Discount factor for future rewards
            epsilon: Exploration rate for epsilon-greedy policy
        """
        self.game = game
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.epsilon = epsilon
        self.q_table: Dict = {}
        self.training_episodes = 0
        # Absolute path so the file is found regardless of working directory
        self.q_table_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'q_table.json'
        )
        
        # Load existing Q-table if available
        self.load_q_table()
    
    def get_state_key(self, state: Dict) -> Tuple:
        """
        Simplified state representation — fast and effective.
        """
        if not state['snake']:
            return ()

        head = state['snake'][0]
        food = state['food']
        snake_set = set(map(tuple, state['snake']))

        # 1. Food direction (simplified to 8 directions)
        dx = food[0] - head[0]
        dy = food[1] - head[1]
        food_dir = (
            0 if dx == 0 else (1 if dx > 0 else -1),
            0 if dy == 0 else (1 if dy > 0 else -1),
        )

        # 2. Danger in all 4 directions
        def is_danger(direction):
            d = {'UP': (0, -1), 'DOWN': (0, 1), 'LEFT': (-1, 0), 'RIGHT': (1, 0)}[direction]
            pos = (head[0] + d[0], head[1] + d[1])
            return (pos[0] < 0 or pos[0] >= self.game.grid_size or
                    pos[1] < 0 or pos[1] >= self.game.grid_size or
                    pos in snake_set)

        danger = (is_danger('UP'), is_danger('DOWN'), is_danger('LEFT'), is_danger('RIGHT'))

        # 3. Body length bucket
        length = len(state['snake'])
        len_bucket = 0 if length <= 5 else (1 if length <= 15 else 2)

        return (food_dir, danger, len_bucket)
    
    def get_q_value(self, state_key: Tuple, action: Direction) -> float:
        """
        Get Q-value for state-action pair.
        
        Args:
            state_key: Hashable state key
            action: Direction action
            
        Returns:
            Q-value for the state-action pair
        """
        if state_key not in self.q_table:
            self.q_table[state_key] = {direction: 0.0 for direction in Direction}
        
        return self.q_table[state_key][action]
    
    def choose_action(self, state: Dict, training: bool = True) -> Optional[Direction]:
        """
        Choose action using epsilon-greedy policy.
        
        Args:
            state: Current game state
            training: Whether in training mode (affects exploration)
            
        Returns:
            Chosen direction, or None if no valid actions
        """
        state_key = self.get_state_key(state)
        valid_actions = self.game.get_valid_moves()
        
        if not valid_actions:
            return None
        
        if training and random.random() < self.epsilon:
            # Exploration: choose random valid action
            return random.choice(valid_actions)
        else:
            # Exploitation: choose best valid action; break ties randomly
            best_q_value = max(
                self.get_q_value(state_key, a) for a in valid_actions
            )
            best_actions = [
                a for a in valid_actions
                if self.get_q_value(state_key, a) == best_q_value
            ]
            return random.choice(best_actions)
    
    def calculate_reward(self, old_state: Dict, new_state: Dict,
                        ate_food: bool, game_over: bool) -> float:
        """
        Calculate reward with shaping for long-term learning.
        Death penalty scales with score; food reward scales with score.
        """
        if game_over:
            return -100 - new_state.get('score', 0) * 2

        if ate_food:
            score = new_state.get('score', 1)
            return 50 + score * 5

        if not old_state['snake'] or not new_state['snake']:
            return -1

        old_head = old_state['snake'][0]
        new_head = new_state['snake'][0]
        food = new_state['food']

        old_distance = abs(old_head[0] - food[0]) + abs(old_head[1] - food[1])
        new_distance = abs(new_head[0] - food[0]) + abs(new_head[1] - food[1])

        if new_distance < old_distance:
            return 2
        elif new_distance > old_distance:
            return -2
        else:
            return -0.5
    
    def update_q_value(self, state_key: Tuple, action: Direction, 
                      reward: float, next_state_key: Tuple) -> None:
        """
        Update Q-value using Q-learning update rule.
        
        Args:
            state_key: Current state key
            action: Action taken
            reward: Reward received
            next_state_key: Next state key
        """
        current_q = self.get_q_value(state_key, action)
        
        # Get maximum Q-value for next state
        if next_state_key in self.q_table:
            max_next_q = max(self.q_table[next_state_key].values())
        else:
            max_next_q = 0.0
        
        # Q-learning update rule
        new_q = current_q + self.learning_rate * (
            reward + self.discount_factor * max_next_q - current_q
        )
        
        self.q_table[state_key][action] = new_q
    
    def train_episode(self) -> Tuple[float, int]:
        """
        Train agent for one episode.

        Returns:
            Tuple of (total_reward, final_score)
        """
        self.game.reset_game()
        total_reward = 0.0
        steps = 0
        max_steps = self.game.grid_size * self.game.grid_size * 3

        while not self.game.game_over and steps < max_steps:
            old_state = self.game.get_state()
            action = self.choose_action(old_state, training=True)

            if action is None:
                break

            ate_food = self.game.move_snake(action)
            new_state = self.game.get_state()

            reward = self.calculate_reward(old_state, new_state, ate_food, self.game.game_over)
            total_reward += reward

            old_state_key = self.get_state_key(old_state)
            new_state_key = self.get_state_key(new_state)
            self.update_q_value(old_state_key, action, reward, new_state_key)

            steps += 1

        self.training_episodes += 1
        return total_reward, self.game.score

    def train(self, episodes: int = 2000, reset_exploration: bool = True) -> list:
        """
        Train agent for multiple episodes.

        Args:
            episodes: Number of training episodes
            reset_exploration: Whether to reset epsilon to 1.0 for fresh exploration

        Returns:
            Training history as list of dicts (sampled every 100 episodes)
        """
        if reset_exploration:
            self.epsilon = 1.0

        min_epsilon = 0.01
        epsilon_decay = (min_epsilon / max(self.epsilon, 0.01)) ** (1.0 / episodes)

        history = []
        recent_scores = []
        best_score = 0

        for episode in range(episodes):
            total_reward, score = self.train_episode()
            recent_scores.append(score)
            best_score = max(best_score, score)
            if len(recent_scores) > 100:
                recent_scores.pop(0)

            self.epsilon = max(min_epsilon, self.epsilon * epsilon_decay)

            if (episode + 1) % 100 == 0 or episode == episodes - 1:
                avg_score = sum(recent_scores) / len(recent_scores)
                history.append({
                    'episode': self.training_episodes,
                    'score': score,
                    'avg_score': round(avg_score, 2),
                    'best_score': best_score,
                    'reward': round(total_reward, 2),
                    'epsilon': round(self.epsilon, 4),
                    'q_table_size': len(self.q_table),
                })

        self.save_q_table()
        return history
    
    def get_next_move(self) -> Optional[Direction]:
        """
        Get next move using trained policy (no exploration).
        
        Returns:
            Next direction to move, or None if no valid moves
        """
        state = self.game.get_state()
        return self.choose_action(state, training=False)
    
    def save_q_table(self) -> None:
        """Save Q-table to JSON file."""
        try:
            # Convert tuple keys to strings for JSON serialization
            serializable_q_table = {}
            for state_key, actions in self.q_table.items():
                state_str = str(state_key)
                serializable_q_table[state_str] = {
                    action.name: q_value for action, q_value in actions.items()
                }
            
            with open(self.q_table_file, 'w') as f:
                json.dump(serializable_q_table, f)
        except Exception as e:
            print(f"Error saving Q-table: {e}")
    
    def load_q_table(self) -> bool:
        """
        Load Q-table from JSON file.
        
        Returns:
            True if successfully loaded, False otherwise
        """
        try:
            if os.path.exists(self.q_table_file):
                with open(self.q_table_file, 'r') as f:
                    serializable_q_table = json.load(f)
                
                # Convert string keys back to tuples
                for state_str, actions in serializable_q_table.items():
                    state_key = eval(state_str)  # Convert string back to tuple
                    self.q_table[state_key] = {}
                    for action_name, q_value in actions.items():
                        action = Direction[action_name]
                        self.q_table[state_key][action] = q_value
                
                return True
        except Exception as e:
            print(f"Error loading Q-table: {e}")
        
        return False
