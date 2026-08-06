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
            <th className="py-2 px-4 text-left">Rank</th>
            <th className="py-2 px-4 text-left">Student</th>
            <th className="py-2 px-4 text-left">Problems Solved</th>
            <th className="py-2 px-4 text-left">First Solved</th>
            <th className="py-2 px-4 text-left">Total Score</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry, index) => (
            <tr key={entry._id || entry.studentId?._id || index} className="border-t">
              <td className="py-2 px-4">{entry.rank || index + 1}</td>
              <td className="py-2 px-4">{entry.studentId?.name || 'Unknown'}</td>
              <td className="py-2 px-4">{entry.problemsSolved ?? 0}</td>
              <td className="py-2 px-4">
                {entry.firstSolvedAt
                  ? new Date(entry.firstSolvedAt).toLocaleString()
                  : '—'}
              </td>
              <td className="py-2 px-4">{entry.totalScore || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeaderboardTable;
