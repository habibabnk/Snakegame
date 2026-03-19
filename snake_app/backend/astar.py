"""
A* pathfinding module for Snake Game.
Enhanced with flood-fill survival check to prevent self-trapping.
"""

import heapq
from typing import List, Tuple, Optional, Set
from .game import SnakeGame, Direction


class AStarPathfinder:
    def __init__(self, game: SnakeGame):
        self.game = game

    def heuristic(self, pos1: Tuple[int, int], pos2: Tuple[int, int]) -> int:
        return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])

    def get_neighbors(self, pos, snake_set):
        neighbors = []
        for direction in Direction:
            dx, dy = direction.value
            new_pos = (pos[0] + dx, pos[1] + dy)
            if (0 <= new_pos[0] < self.game.grid_size and
                    0 <= new_pos[1] < self.game.grid_size and
                    new_pos not in snake_set):
                neighbors.append((new_pos, direction))
        return neighbors

    def find_path(self, start, goal, snake_set) -> Optional[List[Direction]]:
        """Full A* path search returning complete path."""
        counter = 0
        open_set = [(0, counter, start, [])]
        closed_set: Set = set()
        g_scores = {start: 0}

        while open_set:
            _, _, current_pos, path = heapq.heappop(open_set)

            if current_pos in closed_set:
                continue
            closed_set.add(current_pos)

            if current_pos == goal:
                return path

            for neighbor_pos, direction in self.get_neighbors(current_pos, snake_set):
                if neighbor_pos in closed_set:
                    continue
                tentative_g = g_scores[current_pos] + 1
                if neighbor_pos not in g_scores or tentative_g < g_scores[neighbor_pos]:
                    g_scores[neighbor_pos] = tentative_g
                    f_score = tentative_g + self.heuristic(neighbor_pos, goal)
                    counter += 1
                    heapq.heappush(open_set, (f_score, counter, neighbor_pos, path + [direction]))

        return None

    def is_safe_after_eating(self, path: List[Direction]) -> bool:
        """
        Simulate eating food and check if snake still has enough space to survive.
        Uses flood fill to verify at least 50% of free cells are still reachable.
        """
        if not path:
            return False

        # Simulate the snake after following this path and eating food
        sim_snake = list(self.game.snake)
        for direction in path:
            dx, dy = direction.value
            new_head = (sim_snake[0][0] + dx, sim_snake[0][1] + dy)
            sim_snake.insert(0, new_head)
            # Don't pop tail since we eat food at end of path

        sim_snake_set = set(sim_snake)
        # Check reachable space from new head
        reachable = self.game.flood_fill_count(sim_snake[0], sim_snake_set)
        total_free = self.game.grid_size * self.game.grid_size - len(sim_snake)

        # Need at least 30% of space to be reachable
        return reachable >= max(3, total_free * 0.3)

    def get_safest_move(self) -> Optional[Direction]:
        """
        Flood-fill based survival move: pick the direction that maximizes reachable space.
        """
        if not self.game.snake:
            return None

        head = self.game.snake[0]
        valid_moves = self.game.get_valid_moves()

        if not valid_moves:
            return None

        best_move = None
        best_score = -1

        snake_set = set(self.game.snake)

        for move in valid_moves:
            dx, dy = move.value
            new_pos = (head[0] + dx, head[1] + dy)

            # Simulate move (remove tail since not eating)
            sim_snake_set = snake_set.copy()
            sim_snake_set.add(new_pos)
            if len(self.game.snake) > 1:
                sim_snake_set.discard(self.game.snake[-1])

            reachable = self.game.flood_fill_count(new_pos, sim_snake_set)

            if reachable > best_score:
                best_score = reachable
                best_move = move

        return best_move

    def get_next_move(self) -> Optional[Direction]:
        """
        Main decision function:
        1. Try A* path to food
        2. Check if following that path leaves snake with enough space (survival check)
        3. If not safe, use flood-fill survival move instead
        4. Fallback: try to reach food via tail-chase (follow own tail to stay alive)
        """
        if not self.game.snake:
            return None

        snake_set = set(self.game.snake)

        # Try to find path to food
        path = self.find_path(self.game.snake[0], self.game.food, snake_set)

        if path:
            # Safety check: will we have enough space after eating?
            if self.is_safe_after_eating(path):
                return path[0]
            # Path exists but eating is risky — try to follow our own tail to kill time
            tail = self.game.snake[-1]
            # Temporarily remove food from obstacles isn't needed; find path to tail
            tail_path = self.find_path(self.game.snake[0], tail, snake_set)
            if tail_path:
                return tail_path[0]

        # No path to food or tail — use safest flood-fill move
        return self.get_safest_move()