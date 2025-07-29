import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import LeaderboardTable from '../../../common/components/LeaderboardTable';

const Leaderboard = () => {
  const { classId } = useParams();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get(`https://api.algosutra.co.in/questions/classes/${classId}/leaderboard`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setLeaderboard(response.data.leaderboard || []);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch leaderboard');
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [classId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 font-semibold">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <LeaderboardTable leaderboard={leaderboard} />
    </div>
  );
};

export default Leaderboard;