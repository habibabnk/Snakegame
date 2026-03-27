"""
Integration tests for Flask API endpoints.
Tests the complete request-response cycle.
"""

import pytest
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app


@pytest.fixture
def client():
    """Create test client for Flask app."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestResetEndpoint:
    """Tests for POST /api/reset"""

    def test_reset_returns_valid_state(self, client):
        """Reset should return complete game state with score 0."""
        response = client.post('/api/reset',
            json={'game_id': 'main', 'algorithm': 'astar'})
        assert response.status_code == 200
        data = response.get_json()

        assert 'snake' in data
        assert 'food' in data
        assert 'score' in data
        assert 'steps' in data
        assert 'game_over' in data
        assert data['score'] == 0
        assert data['steps'] == 0
        assert data['game_over'] == False

    def test_reset_with_different_algorithms(self, client):
        """Reset should work for both A* and RL algorithms."""
        for algo in ['astar', 'rl']:
            response = client.post('/api/reset',
                json={'game_id': 'main', 'algorithm': algo})
            assert response.status_code == 200


class TestStepEndpoint:
    """Tests for POST /api/step"""

    def test_step_increments_steps(self, client):
        """Each step should increment the step counter."""
        client.post('/api/reset', json={'game_id': 'main', 'algorithm': 'astar'})

        response = client.post('/api/step',
            json={'game_id': 'main', 'algorithm': 'astar'})
        assert response.status_code == 200
        data = response.get_json()
        assert data['steps'] == 1

    def test_step_returns_valid_state(self, client):
        """Step should return complete game state."""
        client.post('/api/reset', json={'game_id': 'main', 'algorithm': 'astar'})
        response = client.post('/api/step',
            json={'game_id': 'main', 'algorithm': 'astar'})

        data = response.get_json()
        assert 'snake' in data
        assert 'food' in data
        assert 'game_over' in data

    def test_step_returns_decision_time(self, client):
        """Step should include decision_time_ms in response."""
        client.post('/api/reset', json={'game_id': 'main', 'algorithm': 'astar'})
        response = client.post('/api/step',
            json={'game_id': 'main', 'algorithm': 'astar'})

        data = response.get_json()
        assert 'decision_time_ms' in data
        assert isinstance(data['decision_time_ms'], (int, float))
        assert data['decision_time_ms'] >= 0


class TestTrainEndpoint:
    """Tests for POST /api/train"""

    def test_train_returns_report(self, client):
        """Training should return episode history and final epsilon."""
        response = client.post('/api/train', json={'episodes': 100})
        assert response.status_code == 200
        data = response.get_json()

        assert 'episodes_trained' in data or 'total_episodes' in data
        assert 'history' in data
        assert 'final_epsilon' in data


class TestCompareEndpoint:
    """Tests for POST /api/compare"""

    def test_compare_returns_stats(self, client):
        """Compare should return statistics for both algorithms."""
        response = client.post('/api/compare', json={'num_games': 3})
        assert response.status_code == 200
        data = response.get_json()

        assert 'astar' in data
        assert 'rl' in data
        assert 'winner' in data
        assert 'avg_score' in data['astar']
        assert 'avg_score' in data['rl']


class TestHistoryEndpoint:
    """Tests for GET /api/history"""

    def test_history_returns_list(self, client):
        """History should return list of past games."""
        response = client.get('/api/history')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, (dict, list))


class TestRaceEndpoints:
    """Tests for /api/race/* endpoints"""

    def test_race_init_returns_both_states(self, client):
        """Race init should return states for both algorithms."""
        response = client.post('/api/race/init')
        assert response.status_code == 200
        data = response.get_json()
        assert 'astar' in data
        assert 'rl' in data
        assert 'snake' in data['astar']
        assert 'snake' in data['rl']

    def test_race_step_returns_leader(self, client):
        """Race step should return leader and race_over flag."""
        client.post('/api/race/init')
        response = client.post('/api/race/step')
        assert response.status_code == 200
        data = response.get_json()
        assert 'astar' in data
        assert 'rl' in data
        assert 'leader' in data
        assert 'race_over' in data
