import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { getExamDetails } from '../../../common/services/api';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

const UseExamTemplate = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { classes } = useSelector((state) => state.classes);
  const [selectedClass, setSelectedClass] = useState(null);
  const [query, setQuery] = useState('');
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classes.length === 0) {
      dispatch(fetchClasses(''));
    }
  }, [dispatch, classes.length]);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setLoading(true);
        const response = await getExamDetails(templateId);
        setTemplate(response.data.exam);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch template:', error);
        alert(error.response?.data?.error || 'Failed to load template');
        navigate('/admin/exams/templates');
      }
    };

    if (templateId) {
      fetchTemplate();
    }
  }, [templateId, navigate]);

  const handleContinue = () => {
    if (selectedClass) {
      // Navigate to CreateExam with classId and templateId
      navigate(`/admin/classes/${selectedClass._id}/exams/create?templateId=${templateId}`);
    }
  };

  // Filter classes based on search query
  const filteredClasses = query === ''
    ? classes
    : classes.filter((cls) =>
        cls.name.toLowerCase().includes(query.toLowerCase())
      );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading template...</div>
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold mb-6">Use Exam Template</h1>
          
          {/* Template Info */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">{template.title}</h2>
            {template.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-2">{template.description}</p>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm mt-3">
              <div>
                <span className="font-semibold">Duration:</span> {template.proctoring?.durationMinutes || 0} min
              </div>
              <div>
                <span className="font-semibold">Questions:</span> {template.questions?.length || 0}
              </div>
              <div>
                <span className="font-semibold">Sections:</span> {template.sections?.length || 0}
              </div>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Select a class to create a new exam from this template.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Select Class *
            </label>
            <Combobox value={selectedClass} onChange={setSelectedClass}>
              <div className="relative">
                <Combobox.Input
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  displayValue={(cls) => cls?.name || ''}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search or select a class..."
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </Combobox.Button>
                <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {filteredClasses.length === 0 && query !== '' ? (
                    <div className="relative cursor-default select-none px-4 py-2 text-gray-700 dark:text-gray-300">
                      No class found.
                    </div>
                  ) : (
                    filteredClasses.map((cls) => (
                      <Combobox.Option
                        key={cls._id}
                        value={cls}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-900 dark:text-gray-300'
                          }`
                        }
                      >
                        {({ selected, active }) => (
                          <>
                            <span
                              className={`block truncate ${
                                selected ? 'font-medium' : 'font-normal'
                              }`}
                            >
                              {cls.name}
                            </span>
                            {selected ? (
                              <span
                                className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                  active ? 'text-white' : 'text-blue-600'
                                }`}
                              >
                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                              </span>
                            ) : null}
                          </>
                        )}
                      </Combobox.Option>
                    ))
                  )}
                </Combobox.Options>
              </div>
            </Combobox>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleContinue}
              disabled={!selectedClass}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Create Exam
            </button>
            <button
              onClick={() => navigate('/admin/exams/templates')}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UseExamTemplate;

