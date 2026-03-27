"""
Unit tests for Q-Learning module.
Tests state representation, Q-value updates, and action selection.
"""

import sys
import os

# Add the parent directory to the path to import backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.game import SnakeGame, Direction
from backend.rl_qlearning import QLearningAgent


class TestQLearningAgent:
    """Test cases for QLearningAgent class."""
    
    def setup_method(self):
        """Setup method run before each test."""
        self.game = SnakeGame(grid_size=10)
        self.agent = QLearningAgent(self.game, learning_rate=0.1, 
                                  discount_factor=0.95, epsilon=0.1)
    
    def test_initialization(self):
        """Test Q-learning agent initialization."""
        assert self.agent.game == self.game
        assert self.agent.learning_rate == 0.1
        assert self.agent.discount_factor == 0.95
        assert self.agent.epsilon == 0.1
        assert isinstance(self.agent.q_table, dict)
        assert self.agent.training_episodes == 0
    
    def test_state_key_generation(self):
        """Test state key generation for Q-table."""
        # Create specific game state
        self.game.snake = [(5, 5)]
        self.game.food = (7, 6)
        
        state = self.game.get_state()
        state_key = self.agent.get_state_key(state)
        
        # Should be a tuple
        assert isinstance(state_key, tuple)
        assert len(state_key) == 2
        
        # First part should be relative food position
        food_rel = state_key[0]
        assert food_rel == (2, 1)  # (7-5, 6-5)
        
        # Second part should be danger detection
        danger = state_key[1]
        assert len(danger) == 4
        assert all(isinstance(d, bool) for d in danger)
    
    def test_state_key_with_danger(self):
        """Test state key with danger detection."""
        # Place snake near wall
        self.game.snake = [(0, 0)]
        self.game.food = (2, 2)
        
        state = self.game.get_state()
        state_key = self.agent.get_state_key(state)
        
        danger = state_key[1]
        
        # Should detect danger in UP and LEFT directions (walls)
        assert danger[0] == True   # UP (wall)
        assert danger[1] == False  # DOWN
        assert danger[2] == True   # LEFT (wall)
        assert danger[3] == False  # RIGHT
    
    def test_q_value_initialization(self):
        """Test Q-value initialization for new states."""
        # Clear any loaded Q-table so the state is genuinely new
        self.agent.q_table = {}
        state_key = ((1, 1), (False, False, False, False))

        # Get Q-value for new state-action pair
        q_value = self.agent.get_q_value(state_key, Direction.UP)

        # Should initialize to 0.0
        assert q_value == 0.0

        # Should create entry in Q-table
        assert state_key in self.agent.q_table
        assert Direction.UP in self.agent.q_table[state_key]
    
    def test_q_value_retrieval(self):
        """Test Q-value retrieval for existing states."""
        state_key = ((1, 1), (False, False, False, False))
        
        # Set Q-value manually
        self.agent.q_table[state_key] = {direction: 0.5 for direction in Direction}
        
        # Retrieve Q-value
        q_value = self.agent.get_q_value(state_key, Direction.RIGHT)
        
        assert q_value == 0.5
    
    def test_choose_action_exploration(self):
        """Test action selection in exploration mode."""
        state = self.game.get_state()
        
        # Force exploration by setting epsilon to 1.0
        original_epsilon = self.agent.epsilon
        self.agent.epsilon = 1.0
        
        # Choose action in training mode
        action = self.agent.choose_action(state, training=True)
        
        # Should return a valid action
        assert action in self.game.get_valid_moves()
        
        # Restore epsilon
        self.agent.epsilon = original_epsilon
    
    def test_choose_action_exploitation(self):
        """Test action selection in exploitation mode."""
        state = self.game.get_state()
        state_key = self.agent.get_state_key(state)
        
        # Set Q-values to favor a specific action
        valid_moves = self.game.get_valid_moves()
        if valid_moves:
            best_action = valid_moves[0]
            
            # Set high Q-value for best action
            self.agent.q_table[state_key] = {direction: 0.0 for direction in Direction}
            self.agent.q_table[state_key][best_action] = 10.0
            
            # Force exploitation by setting epsilon to 0.0
            original_epsilon = self.agent.epsilon
            self.agent.epsilon = 0.0
            
            # Choose action in training mode
            action = self.agent.choose_action(state, training=True)
            
            # Should choose the action with highest Q-value
            assert action == best_action
            
            # Restore epsilon
            self.agent.epsilon = original_epsilon
    
    def test_choose_action_inference_mode(self):
        """Test action selection in inference mode."""
        state = self.game.get_state()
        state_key = self.agent.get_state_key(state)
        
        # Set Q-values
        valid_moves = self.game.get_valid_moves()
        if valid_moves:
            best_action = valid_moves[0]
            self.agent.q_table[state_key] = {direction: 0.0 for direction in Direction}
            self.agent.q_table[state_key][best_action] = 10.0
            
            # Choose action in inference mode
            action = self.agent.choose_action(state, training=False)
            
            # Should choose best action regardless of epsilon
            assert action == best_action
    
    def test_reward_calculation_eat_food(self):
        """Test reward calculation when food is eaten."""
        old_state = self.game.get_state()
        self.game.food = (6, 5)  # Place food in front of snake
        new_state = self.game.get_state()
        
        reward = self.agent.calculate_reward(old_state, new_state, True, False)
        
        assert reward == 50  # Large reward for eating food
    
    def test_reward_calculation_game_over(self):
        """Test reward calculation when game is over."""
        old_state = self.game.get_state()
        new_state = self.game.get_state()
        new_state['game_over'] = True
        
        reward = self.agent.calculate_reward(old_state, new_state, False, True)
        
        assert reward == -100  # Large penalty for game over
    
    def test_reward_calculation_closer_to_food(self):
        """Test reward calculation when moving closer to food."""
        self.game.snake = [(5, 5)]
        self.game.food = (7, 5)
        
        old_state = self.game.get_state()
        self.game.move_snake(Direction.RIGHT)  # Move closer
        new_state = self.game.get_state()
        
        reward = self.agent.calculate_reward(old_state, new_state, False, False)
        
        assert reward == 1  # Small reward for moving closer
    
    def test_reward_calculation_further_from_food(self):
        """Test reward calculation when moving away from food."""
        self.game.snake = [(5, 5)]
        self.game.food = (7, 5)
        
        old_state = self.game.get_state()
        self.game.move_snake(Direction.LEFT)  # Move away
        new_state = self.game.get_state()
        
        reward = self.agent.calculate_reward(old_state, new_state, False, False)
        
        assert reward == -1  # Small penalty for moving away
    
    def test_q_value_update(self):
        """Test Q-value update rule."""
        state_key = ((1, 1), (False, False, False, False))
        next_state_key = ((2, 1), (False, False, False, False))
        action = Direction.RIGHT
        reward = 10.0
        
        # Set initial Q-value
        self.agent.q_table[state_key] = {direction: 0.0 for direction in Direction}
        self.agent.q_table[next_state_key] = {direction: 5.0 for direction in Direction}
        
        old_q_value = self.agent.q_table[state_key][action]
        
        # Update Q-value
        self.agent.update_q_value(state_key, action, reward, next_state_key)
        
        new_q_value = self.agent.q_table[state_key][action]
        
        # Q-value should increase
        assert new_q_value > old_q_value
        
        # Check update rule: Q(s,a) = Q(s,a) + α * (r + γ * max(Q(s',a')) - Q(s,a))
        expected_new_q = old_q_value + self.agent.learning_rate * (
            reward + self.agent.discount_factor * 5.0 - old_q_value
        )
        assert abs(new_q_value - expected_new_q) < 0.001
    
    def test_train_episode(self):
        """Test training episode execution."""
        initial_episodes = self.agent.training_episodes
        
        total_reward, final_score = self.agent.train_episode()
        
        # Should have completed one episode
        assert self.agent.training_episodes == initial_episodes + 1
        
        # Should return reasonable values
        assert isinstance(total_reward, float)
        assert isinstance(final_score, int)
        assert final_score >= 0
    
    def test_train_multiple_episodes(self):
        """Test training multiple episodes."""
        initial_episodes = self.agent.training_episodes
        
        self.agent.train(episodes=5)
        
        # Should have completed 5 episodes
        assert self.agent.training_episodes == initial_episodes + 5
    
    def test_epsilon_decay(self):
        """Test epsilon decay during training."""
        initial_epsilon = self.agent.epsilon
        
        # Train for 100 episodes to trigger decay
        self.agent.train(episodes=100)
        
        # Epsilon should have decayed
        assert self.agent.epsilon < initial_epsilon
        assert self.agent.epsilon >= 0.01  # Should not go below minimum
    
    def test_get_next_move(self):
        """Test getting next move in inference mode."""
        # Train agent briefly
        self.agent.train(episodes=10)
        
        # Get next move
        next_move = self.agent.get_next_move()
        
        # Should return a valid move or None
        if next_move:
            assert next_move in self.game.get_valid_moves()
        else:
            assert len(self.game.get_valid_moves()) == 0
    
    def test_save_and_load_q_table(self):
        """Test Q-table persistence."""
        # Add some Q-values
        state_key = ((1, 1), (False, False, False, False))
        self.agent.q_table[state_key] = {direction: 1.5 for direction in Direction}
        
        # Save Q-table
        self.agent.save_q_table()
        
        # Create new agent and load Q-table
        new_agent = QLearningAgent(self.game)
        loaded = new_agent.load_q_table()
        
        assert loaded == True
        assert state_key in new_agent.q_table
        
        for direction in Direction:
            assert new_agent.q_table[state_key][direction] == 1.5
    
    def test_state_key_consistency(self):
        """Test that state keys are consistent for same states."""
        self.game.snake = [(5, 5)]
        self.game.food = (7, 6)
        
        state = self.game.get_state()
        state_key1 = self.agent.get_state_key(state)
        state_key2 = self.agent.get_state_key(state)
        
        assert state_key1 == state_key2
    
    def test_action_selection_with_no_valid_moves(self):
        """Test action selection when no valid moves exist."""
        # Create game over situation
        self.game.snake = [(0, 0), (0, 1), (1, 0)]
        
        state = self.game.get_state()
        action = self.agent.choose_action(state, training=True)
        
        # Should return None when no valid moves
        assert action is None


