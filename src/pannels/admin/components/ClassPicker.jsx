import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Combobox } from '@headlessui/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { inputClass } from '../../../common/ui/format';

/** Searchable class selector backed by the shared class list. Active classes are listed first. */
export default function ClassPicker({ value, onChange, id, autoFocus = false, filter }) {
  const dispatch = useDispatch();
  const { classes, status } = useSelector((state) => state.classes);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (status === 'idle') dispatch(fetchClasses(''));
  }, [dispatch, status]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes
      .filter((c) => !filter || filter(c))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'active' ? -1 : 1));
  }, [classes, filter, query]);

  return (
    <Combobox value={value} onChange={onChange} by="_id">
      <div className="relative">
        <Combobox.Input
          id={id}
          autoFocus={autoFocus}
          className={`${inputClass} h-10 pr-9`}
          displayValue={(cls) => cls?.name || ''}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={status === 'loading' ? 'Loading classes…' : 'Search or select a class'}
        />
        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
          <ChevronsUpDown className="w-4 h-4" aria-hidden="true" />
        </Combobox.Button>
        <Combobox.Options className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-xl focus:outline-none">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">
              {status === 'failed' ? "Couldn't load classes." : query ? 'No class matches your search.' : 'No classes yet.'}
            </div>
          ) : (
            options.map((cls) => (
              <Combobox.Option
                key={cls._id}
                value={cls}
                className={({ focus }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-xs cursor-pointer ${focus ? 'bg-hover text-fg' : 'text-body'}`
                }
              >
                {({ selected }) => (
                  <>
                    <Check className={`w-3.5 h-3.5 shrink-0 text-accent ${selected ? '' : 'invisible'}`} aria-hidden="true" />
                    <span className={`flex-1 truncate ${selected ? 'font-semibold text-fg' : ''}`}>{cls.name}</span>
                    <span className="text-[11px] text-subtle whitespace-nowrap">
                      {cls.students?.length || 0} students
                      {cls.status !== 'active' && <span className="text-warn"> · inactive</span>}
                    </span>
                  </>
                )}
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}
