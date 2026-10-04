import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminCreateQuestion } from '../../../common/services/api';
import { StatusChip } from '../../../common/ui/primitives';
import { notify } from '../../../common/ui/Toast';
import QuestionForm from '../components/AdminQuestionForm';

const AdminCreateNewQuestion = () => {
  const navigate = useNavigate();
  const base = useLocation().pathname.startsWith('/teacher') ? '/teacher' : '/admin';

  const save = async (payload) => {
    const res = await adminCreateQuestion({ ...payload, status: 'draft', isDraft: true });
    notify('Draft saved. You can now test the solution and publish.', 'success');
    const id = res.data?.question?._id;
    navigate(id ? `${base}/questions/${id}/edit` : `${base}/questions/drafts`, { replace: true });
  };

  return (
    <QuestionForm
      heading="New question"
      badges={<StatusChip kind="warning">New draft</StatusChip>}
      backTo={`${base}/questions`}
      saveLabel="Save draft"
      onSave={save}
      allowImport
    />
  );
};

export default AdminCreateNewQuestion;
