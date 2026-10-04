import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { getLeaderboard } from '../../../common/services/api';
import { Button, EmptyState, Table } from '../../../common/ui/primitives';
import { table as tableClass, type } from '../../../common/ui/format';

const COLUMNS = [
  { label: 'Rank' },
  { label: 'Student' },
  { label: 'Solved', className: 'text-right' },
  { label: 'First solved', className: 'hidden md:table-cell' },
  { label: 'Score', className: 'hidden sm:table-cell text-right' },
];

const Leaderboard = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!classId) {
      setError('Class ID is required');
      setLoading(false);
      return;
    }
    getLeaderboard(classId)
      .then((res) => setRows(res.data.leaderboard || []))
      .catch((err) => setError(typeof err === 'string' ? err : 'Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, [classId]);

  const back = classId ? `/student/classes/${classId}` : '/student';

  if (error) {
    return (
      <div className="px-4 sm:px-5 py-6">
        <EmptyState icon={Trophy} title="Leaderboard unavailable" message={error} action={<Button variant="secondary" onClick={() => navigate(back)}>Back</Button>} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <header className="shrink-0 flex items-center gap-2 mb-3">
        <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={() => navigate(back)} aria-label="Back" />
        <h1 className={type.pageTitle}>Leaderboard</h1>
      </header>
      {loading ? (
        <div className="flex-1 grid place-items-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Trophy} title="No rankings yet" message="Solve published questions to appear here." />
      ) : (
        <Table columns={COLUMNS} fill>
          {rows.map((row, index) => (
            <tr key={row._id || row.studentId?._id || index} className={tableClass.row}>
              <td className={tableClass.td}>{row.rank || index + 1}</td>
              <td className={tableClass.td}>
                <p className="text-sm font-semibold text-fg">{row.studentId?.name || 'Unknown'}</p>
              </td>
              <td className={`${tableClass.td} text-right tabular-nums`}>{row.problemsSolved ?? 0}</td>
              <td className={`${tableClass.td} hidden md:table-cell text-body`}>
                {row.firstSolvedAt ? new Date(row.firstSolvedAt).toLocaleString() : '—'}
              </td>
              <td className={`${tableClass.td} hidden sm:table-cell text-right tabular-nums`}>{row.totalScore || 0}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
};

export default Leaderboard;
