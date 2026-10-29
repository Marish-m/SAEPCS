import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Filter } from 'lucide-react';
import EmptyState from './EmptyState';

const DataTable = ({
  columns = [],
  data = [],
  searchPlaceholder = 'Search records...',
  searchField = 'name',
  filterOptions = null, // [{ label: 'Department', key: 'department', options: ['CSE', 'IT'] }]
  itemsPerPage = 10,
  actionButton = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Handle Sort
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter & Search logic
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Search matching
      const searchValue = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (item[searchField] && item[searchField].toString().toLowerCase().includes(searchValue)) ||
        (item.rollNumber && item.rollNumber.toLowerCase().includes(searchValue)) ||
        (item.email && item.email.toLowerCase().includes(searchValue)) ||
        (item.title && item.title.toLowerCase().includes(searchValue));

      // Filter matching
      let matchesFilters = true;
      Object.entries(activeFilters).forEach(([key, val]) => {
        if (val && item[key] !== val) {
          matchesFilters = false;
        }
      });

      return matchesSearch && matchesFilters;
    });
  }, [data, searchTerm, searchField, activeFilters]);

  // Sort logic
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute w-4 h-4 text-slate-400 left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Filter Dropdowns and Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {filterOptions &&
            filterOptions.map((filter) => (
              <div key={filter.key} className="relative">
                <select
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => {
                    setActiveFilters((prev) => ({
                      ...prev,
                      [filter.key]: e.target.value || undefined,
                    }));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 transition-all appearance-none pr-8 cursor-pointer"
                >
                  <option value="">All {filter.label}s</option>
                  {filter.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <Filter className="absolute w-3.5 h-3.5 text-slate-400 right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ))}

          {actionButton}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl">
        {paginatedData.length === 0 ? (
          <EmptyState
            title="No matching records"
            description="No items match your active search filter criteria."
          />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-5 py-3.5 ${
                      col.sortable ? 'cursor-pointer select-none hover:text-indigo-400' : ''
                    } ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {col.sortable && <ArrowUpDown className="w-3 h-3 opacity-60" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {paginatedData.map((row, index) => (
                <tr
                  key={row._id || index}
                  className="hover:bg-indigo-950/20 transition-colors duration-150 group"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-5 py-4 ${col.className || ''}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Bar */}
      {sortedData.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
            <span className="font-semibold text-slate-200">
              {Math.min(currentPage * itemsPerPage, sortedData.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-200">{sortedData.length}</span> records
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-semibold text-slate-200 bg-slate-900 border border-slate-800 rounded-lg">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
