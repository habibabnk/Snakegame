"""
Unit tests for A* pathfinding module.
Tests path calculation, heuristic function, and move selection.
"""

import pytest
import sys
import os

# Add the parent directory to the path to import backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.game import SnakeGame, Direction
from backend.astar import AStarPathfinder


class TestAStarPathfinder:
    """Test cases for AStarPathfinder class."""
    
    def setup_method(self):
        """Setup method run before each test."""
        self.game = SnakeGame(grid_size=10)
        self.astar = AStarPathfinder(self.game)
    
    def test_initialization(self):
        """Test A* pathfinder initialization."""
        assert self.astar.game == self.game
        assert callable(self.astar.heuristic)
        assert callable(self.astar.get_neighbors)
    
    def test_heuristic_manhattan_distance(self):
        """Test Manhattan distance heuristic."""
        pos1 = (0, 0)
        pos2 = (3, 4)
        
        distance = self.astar.heuristic(pos1, pos2)
        assert distance == 7  # |3-0| + |4-0| = 7
        
        # Test symmetry
        distance2 = self.astar.heuristic(pos2, pos1)
        assert distance2 == 7
        
        # Test same position
        assert self.astar.heuristic(pos1, pos1) == 0
    
    def test_get_neighbors_center(self):
        """Test neighbor calculation from center position."""
        neighbors = self.astar.get_neighbors((5, 5))
        
        # Should have 4 neighbors from center
        assert len(neighbors) == 4
        
        # Check all directions are present
        positions = [pos for pos, _ in neighbors]
        directions = [dir for _, dir in neighbors]
        
        assert (5, 4) in positions  # UP
        assert (5, 6) in positions  # DOWN
        assert (4, 5) in positions  # LEFT
        assert (6, 5) in positions  # RIGHT
        
        assert Direction.UP in directions
        assert Direction.DOWN in directions
        assert Direction.LEFT in directions
        assert Direction.RIGHT in directions
    
    def test_get_neighbors_edge(self):
        """Test neighbor calculation from edge position."""
        neighbors = self.astar.get_neighbors((0, 0))  # Top-left corner
        
        # Should have only 2 neighbors from corner
        assert len(neighbors) == 2
        
        positions = [pos for pos, _ in neighbors]
        
        assert (0, 1) in positions  # DOWN
        assert (1, 0) in positions  # RIGHT
        assert (0, -1) not in positions  # UP (outside grid)
        assert (-1, 0) not in positions  # LEFT (outside grid)
    
    def test_get_neighbors_with_snake_body(self):
        """Test neighbor calculation avoiding snake body."""
        # Create snake body that blocks some moves
        self.game.snake = [(5, 5), (5, 4), (4, 5)]  # Head at (5,5)
        
        neighbors = self.astar.get_neighbors((5, 5))
        
        # Should have only 2 valid neighbors (UP and LEFT blocked by body)
        assert len(neighbors) == 2
        
        positions = [pos for pos, _ in neighbors]
        
        assert (5, 6) in positions  # DOWN (valid)
        assert (6, 5) in positions  # RIGHT (valid)
        assert (5, 4) not in positions  # UP (blocked by snake)
        assert (4, 5) not in positions  # LEFT (blocked by snake)
    
    def test_find_path_to_food_simple(self):
        """Test simple path finding to food."""
        # Place snake and food in simple configuration
        self.game.snake = [(5, 5)]
        self.game.food = (7, 5)  # 2 steps to the right
        
        next_move = self.astar.find_path_to_food()
        
        # Should move right towards food
        assert next_move == Direction.RIGHT
    
    def test_find_path_to_food_complex(self):
        """Test path finding with obstacles."""
        # Create obstacle course
        self.game.snake = [(5, 5), (6, 5), (7, 5)]  # Horizontal snake
        self.game.food = (6, 7)  # Food below middle of snake
        
        next_move = self.astar.find_path_to_food()
        
        # Should find a path around the obstacle
        assert next_move in [Direction.UP, Direction.LEFT, Direction.RIGHT]
        assert next_move != Direction.DOWN  # Down is blocked by snake body
    
    def test_find_path_to_food_unreachable(self):
        """Test path finding when food is unreachable."""
        # Create snake that completely surrounds food
        self.game.snake = [
            (5, 5), (6, 5), (7, 5), (7, 6), (7, 7), 
            (6, 7), (5, 7), (5, 6)  # Rectangle around (6,6)
        ]
        self.game.food = (6, 6)  # Food inside rectangle
        
        next_move = self.astar.find_path_to_food()
        
        # Should return None (no path)
        assert next_move is None
    
    def test_get_safest_move(self):
        """Test safest move selection when no path exists."""
        # Place snake near walls and food
        self.game.snake = [(1, 1)]
        self.game.food = (8, 8)  # Far away
        
        safest_move = self.astar.get_safest_move()
        
        # Should return a valid move
        assert safest_move in self.game.get_valid_moves()
        
        # Should prefer moves away from walls
        assert safest_move != Direction.LEFT
        assert safest_move != Direction.UP
    
    def test_get_next_move_with_path(self):
        """Test getting next move when path exists."""
        # Simple configuration
        self.game.snake = [(5, 5)]
        self.game.food = (6, 5)  # One step to the right
        
        next_move = self.astar.get_next_move()
        
        assert next_move == Direction.RIGHT
    
    def test_get_next_move_without_path(self):
        """Test getting next move when no path exists."""
        # Create impossible situation
        self.game.snake = [(5, 5), (6, 5), (7, 5), (7, 6), (7, 7), (6, 7), (5, 7), (5, 6)]
        self.game.food = (6, 6)
        
        next_move = self.astar.get_next_move()
        
        # Should return safest move (not None)
        assert next_move is not None
        assert next_move in self.game.get_valid_moves()
    
    def test_get_next_move_no_valid_moves(self):
        """Test getting next move when no valid moves exist."""
        # Place snake in corner with body blocking exits
        self.game.snake = [(0, 0), (0, 1), (1, 0)]
        
        next_move = self.astar.get_next_move()
        
        # Should return None when no valid moves
        assert next_move is None
    
    def test_path_optimization(self):
        """Test that A* finds optimal (shortest) path."""
        # Create L-shaped obstacle
        self.game.snake = [(5, 5)]
        self.game.food = (7, 7)
        
        # Add obstacles to force specific path
        # (This is a simplified test - in practice, path optimality
        # would be tested with more complex scenarios)
        next_move = self.astar.find_path_to_food()
        
        # Should move towards food in optimal way
        assert next_move in [Direction.RIGHT, Direction.DOWN]
    
    def test_performance_large_grid(self):
        """Test A* performance on larger grid."""
        # Create larger game for performance testing
        large_game = SnakeGame(grid_size=20)
        large_astar = AStarPathfinder(large_game)
        
        # Place food far away
        large_game.snake = [(10, 10)]
        large_game.food = (19, 19)
        
        # Should complete in reasonable time
        import time
        start_time = time.time()
        next_move = large_astar.find_path_to_food()
        end_time = time.time()
        
        # Should complete quickly (less than 0.1 seconds for 20x20 grid)
        assert end_time - start_time < 0.1
        assert next_move is not None


if __name__ == '__main__':
    pytest.main([__file__])
