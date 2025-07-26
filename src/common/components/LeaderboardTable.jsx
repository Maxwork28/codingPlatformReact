import React from 'react';

const LeaderboardTable = ({ leaderboard }) => {
  console.log('LeaderboardTable: Rendered with leaderboard', leaderboard);

  if (!leaderboard || leaderboard.length === 0) {
    return <p>No leaderboard data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white rounded-lg shadow-md">
        <thead>
          <tr className="bg-indigo-600 text-white">
            <th className="py-2 px-4">Rank</th>
            <th className="py-2 px-4">Student</th>
            <th className="py-2 px-4">Total Score</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry) => (
            <tr key={entry._id} className="border-t">
              <td className="py-2 px-4">{entry.rank}</td>
              <td className="py-2 px-4">{entry.studentId?.name || 'Unknown'}</td>
              <td className="py-2 px-4">{entry.totalScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeaderboardTable;