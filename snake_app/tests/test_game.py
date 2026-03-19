"""
Unit tests for Snake Game module.
Tests core game logic, collision detection, and state management.
"""

import pytest
import sys
import os

# Add the parent directory to the path to import backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.game import SnakeGame, Direction


class TestSnakeGame:
    """Test cases for SnakeGame class."""
    
    def setup_method(self):
        """Setup method run before each test."""
        self.game = SnakeGame(grid_size=10)
    
    def test_initialization(self):
        """Test game initialization."""
        assert self.game.grid_size == 10
        assert len(self.game.snake) == 1
        assert self.game.score == 0
        assert self.game.steps == 0
        assert not self.game.game_over
        assert self.game.direction == Direction.RIGHT
    
    def test_reset_game(self):
        """Test game reset functionality."""
        # Modify game state
        self.game.score = 5
        self.game.steps = 10
        self.game.game_over = True
        
        # Reset game
        self.game.reset_game()
        
        # Check reset state
        assert self.game.score == 0
        assert self.game.steps == 0
        assert not self.game.game_over
        assert len(self.game.snake) == 1
    
    def test_move_snake_valid_move(self):
        """Test valid snake movement."""
        initial_score = self.game.score
        initial_length = len(self.game.snake)
        
        # Move right (should be valid)
        ate_food = self.game.move_snake(Direction.RIGHT)
        
        assert not ate_food
        assert self.game.score == initial_score
        assert len(self.game.snake) == initial_length
        assert self.game.steps == 1
        assert not self.game.game_over
    
    def test_move_snake_wall_collision(self):
        """Test wall collision detection."""
        # Move snake to edge
        self.game.snake = [(9, 5)]  # Right edge
        
        # Try to move into wall
        ate_food = self.game.move_snake(Direction.RIGHT)
        
        assert not ate_food
        assert self.game.game_over
    
    def test_move_snake_self_collision(self):
        """Test self-collision detection."""
        # Create snake that will collide with itself
        self.game.snake = [(5, 5), (4, 5), (3, 5), (3, 4)]
        
        # Try to move into body
        ate_food = self.game.move_snake(Direction.UP)
        
        assert not ate_food
        assert self.game.game_over
    
    def test_eat_food(self):
        """Test food eating functionality."""
        # Place food directly in front of snake
        head = self.game.snake[0]
        food_pos = (head[0] + 1, head[1])
        self.game.food = food_pos
        
        # Move towards food
        ate_food = self.game.move_snake(Direction.RIGHT)
        
        assert ate_food
        assert self.game.score == 1
        assert len(self.game.snake) == 2  # Snake grows
        assert self.game.food != food_pos  # New food spawned
    
    def test_get_valid_moves(self):
        """Test valid moves calculation."""
        # Place snake in center
        self.game.snake = [(5, 5)]
        
        valid_moves = self.game.get_valid_moves()
        
        # Should have 3 valid moves (can't go left into itself if direction is RIGHT)
        assert len(valid_moves) >= 3
        assert Direction.UP in valid_moves
        assert Direction.DOWN in valid_moves
        assert Direction.RIGHT in valid_moves
    
    def test_get_valid_moves_edge(self):
        """Test valid moves from edge position."""
        # Place snake in corner
        self.game.snake = [(0, 0)]
        
        valid_moves = self.game.get_valid_moves()
        
        # Should have only 2 valid moves from corner
        assert len(valid_moves) == 2
        assert Direction.RIGHT in valid_moves
        assert Direction.DOWN in valid_moves
        assert Direction.UP not in valid_moves
        assert Direction.LEFT not in valid_moves
    
    def test_get_state(self):
        """Test game state serialization."""
        state = self.game.get_state()
        
        assert 'snake' in state
        assert 'food' in state
        assert 'score' in state
        assert 'steps' in state
        assert 'game_over' in state
        assert 'direction' in state
        assert 'grid_size' in state
        
        assert state['score'] == self.game.score
        assert state['steps'] == self.game.steps
        assert state['game_over'] == self.game.game_over
        assert state['direction'] == self.game.direction.name
    
    def test_set_state(self):
        """Test game state deserialization."""
        # Create test state
        test_state = {
            'snake': [(3, 3), (2, 3), (1, 3)],
            'food': (5, 5),
            'score': 3,
            'steps': 15,
            'game_over': False,
            'direction': 'DOWN',
            'grid_size': 10
        }
        
        # Set state
        self.game.set_state(test_state)
        
        # Verify state was set correctly
        assert self.game.snake == [(3, 3), (2, 3), (1, 3)]
        assert self.game.food == (5, 5)
        assert self.game.score == 3
        assert self.game.steps == 15
        assert not self.game.game_over
        assert self.game.direction == Direction.DOWN
    
    def test_steps_without_food_limit(self):
        """Test game over after too many steps without food."""
        # Set steps without food to maximum
        self.game.steps_without_food = self.game.max_steps_without_food
        
        # Make a valid move
        ate_food = self.game.move_snake(Direction.RIGHT)
        
        # Game should be over due to step limit
        assert not ate_food
        assert self.game.game_over
    
    def test_food_generation_avoids_snake(self):
        """Test that food never spawns on snake."""
        # Create large snake
        self.game.snake = [(5, 5), (4, 5), (3, 5), (2, 5), (1, 5)]
        
        # Generate food multiple times
        for _ in range(100):
            food = self.game._generate_food()
            assert food not in self.game.snake
            assert 0 <= food[0] < self.game.grid_size
            assert 0 <= food[1] < self.game.grid_size


if __name__ == '__main__':
    pytest.main([__file__])
