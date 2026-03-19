"""
Game management module for Snake Game.
"""

import random
from enum import Enum
from typing import List, Tuple, Dict, Any
from collections import deque


class Direction(Enum):
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)


class SnakeGame:
    def __init__(self, grid_size: int = 10):
        self.grid_size = grid_size
        self.reset_game()

    def reset_game(self) -> None:
        center = self.grid_size // 2
        self.snake: List[Tuple[int, int]] = [(center, center)]
        self.direction: Direction = Direction.RIGHT
        self.food: Tuple[int, int] = self._generate_food()
        self.score: int = 0
        self.steps: int = 0
        self.game_over: bool = False
        self.steps_without_food: int = 0
        self.max_steps_without_food: int = self.grid_size * self.grid_size * 3

    def _generate_food(self) -> Tuple[int, int]:
        empty = [
            (x, y)
            for x in range(self.grid_size)
            for y in range(self.grid_size)
            if (x, y) not in self.snake
        ]
        return random.choice(empty) if empty else (0, 0)

    def get_valid_moves(self) -> List[Direction]:
        if not self.snake:
            return []
        head = self.snake[0]
        valid = []
        for d in Direction:
            dx, dy = d.value
            np_ = (head[0] + dx, head[1] + dy)
            if (0 <= np_[0] < self.grid_size and
                    0 <= np_[1] < self.grid_size and
                    np_ not in self.snake):
                valid.append(d)
        return valid

    def flood_fill_count(self, start: Tuple[int, int], snake_set=None) -> int:
        """Count reachable cells from start position."""
        if snake_set is None:
            snake_set = set(self.snake)
        visited = {start}
        queue = deque([start])
        while queue:
            pos = queue.popleft()
            for d in Direction:
                dx, dy = d.value
                npos = (pos[0] + dx, pos[1] + dy)
                if (0 <= npos[0] < self.grid_size and
                        0 <= npos[1] < self.grid_size and
                        npos not in snake_set and
                        npos not in visited):
                    visited.add(npos)
                    queue.append(npos)
        return len(visited)

    def move_snake(self, new_direction: Direction) -> bool:
        if self.game_over or not self.snake:
            return False
        head = self.snake[0]
        dx, dy = new_direction.value
        new_head = (head[0] + dx, head[1] + dy)

        if (new_head[0] < 0 or new_head[0] >= self.grid_size or
                new_head[1] < 0 or new_head[1] >= self.grid_size):
            self.game_over = True
            return False

        if new_head in self.snake:
            self.game_over = True
            return False

        self.snake.insert(0, new_head)
        self.steps += 1

        if new_head == self.food:
            self.score += 1
            self.food = self._generate_food()
            self.steps_without_food = 0
            return True
        else:
            self.snake.pop()
            self.steps_without_food += 1

        if self.steps_without_food > self.max_steps_without_food:
            self.game_over = True
            return False

        return False

    def get_state(self) -> Dict[str, Any]:
        return {
            'snake': self.snake.copy(),
            'food': self.food,
            'score': self.score,
            'steps': self.steps,
            'game_over': self.game_over,
            'direction': self.direction.name,
            'grid_size': self.grid_size
        }

    def set_state(self, state: Dict[str, Any]) -> None:
        self.snake = state['snake'].copy()
        self.food = state['food']
        self.score = state['score']
        self.steps = state['steps']
        self.game_over = state['game_over']
        self.direction = Direction[state['direction']]
        self.grid_size = state.get('grid_size', self.grid_size)
        self.steps_without_food = state.get('steps_without_food', 0)