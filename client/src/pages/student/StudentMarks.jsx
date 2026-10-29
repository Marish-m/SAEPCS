import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/common/StatCard';
import MarksComparisonChart from '../../components/charts/MarksComparisonChart';
import PDFExportButton from '../../components/reports/PDFExportButton';
import apiService from '../../api/apiService';
import { SAMPLE_MARKS_ANALYTICS } from '../../data/mockData';
import { Award, BookOpen, TrendingUp, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

const StudentMarks = () => {
  const { user } = useAuth();
  const studentId = user?.profile?._id || user?._id || 'CS2026-001';

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMarks = async () => {
    setLoading(true);
    try {
      const res = await apiService.getStudentMarksAnalytics(studentId);
      if (res.data?.analytics) {
        setAnalytics(res.data.analytics);
      }
    } catch (err) {
      console.warn('Using fallback student marks data:', err);
      if (!analytics) {
        setAnalytics(SAMPLE_MARKS_ANALYTICS);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarks();
  }, [studentId]);

  const activeMarks = analytics || SAMPLE_MARKS_ANALYTICS;
  const isRemedial = (activeMarks.overallAveragePercentage || 0) < 50;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <span>Internal Assessment Scores & Evaluation</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Continuous evaluation performance across internal examinations, quizzes, and continuous tests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PDFExportButton
            reportType="marks"
            studentId={studentId}
            btnText="Export Marks PDF"
            className="py-1.5 text-xs"
          />
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
              isRemedial
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}
          >
            {isRemedial ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Academic Remedial Advisory (&lt;50%)</span>
              </>
            ) : (
              <span>Overall Average: {activeMarks.overallAveragePercentage}%</span>
            )}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Overall Average"
          value={`${activeMarks.overallAveragePercentage}%`}
          subtext="Aggregate internal score"
          icon={TrendingUp}
          color={isRemedial ? 'rose' : 'indigo'}
        />
        <StatCard
          title="Total Marks Obtained"
          value={
            activeMarks.totalMax
              ? `${activeMarks.totalObtained} / ${activeMarks.totalMax}`
              : `${Math.round(activeMarks.overallAveragePercentage * 2.5)} / 250`
          }
          subtext="Cumulative points scored"
          icon={Award}
          color="emerald"
        />
        <StatCard
          title="Assessments Conducted"
          value={activeMarks.totalAssessments?.toString() || '0'}
          subtext="Evaluated by department faculty"
          icon={BookOpen}
          color="cyan"
        />
        <StatCard
          title="Academic Standing"
          value={activeMarks.academicStanding || (isRemedial ? 'Remedial' : 'Good Standing')}
          subtext="Pass benchmark is 50%"
          icon={CheckCircle}
          color={isRemedial ? 'rose' : 'purple'}
        />
      </div>

      {/* Chart */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
        <h3 className="text-sm font-bold text-white tracking-wide mb-1">Subject Performance Comparison</h3>
        <p className="text-xs text-slate-400 mb-4">Marks obtained vs maximum potential marks across courses</p>
        <MarksComparisonChart />
      </div>

      {/* Subject Assessments Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white tracking-wide">Course Evaluation Transcripts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeMarks.subjectAverages &&
            activeMarks.subjectAverages.map((sub, idx) => {
              const subRemedial = sub.averagePercentage < 50;
              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{sub.subject}</h4>
                      {sub.code && <span className="text-[10px] text-slate-400 font-mono">{sub.code}</span>}
                    </div>
                    <span
                      className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md border ${
                        subRemedial
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}
                    >
                      {sub.averagePercentage}% Avg
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sub.assessments &&
                      sub.assessments.map((ass, i) => {
                        const assRemedial = ass.percentage < 50;
                        return (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                          >
                            <div>
                              <span className="font-semibold text-slate-200 block">
                                {ass.title || ass.type}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {ass.date ? new Date(ass.date).toLocaleDateString() : 'Recorded'}
                              </span>
                              {ass.remarks && (
                                <span className="text-[10px] text-slate-400 italic block mt-0.5">
                                  Note: {ass.remarks}
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-white block">
                                <span className={assRemedial ? 'text-rose-400' : 'text-emerald-400'}>
                                  {ass.obtained}
                                </span>{' '}
                                <span className="text-slate-500">/ {ass.max}</span>
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  assRemedial ? 'text-rose-400' : 'text-slate-400'
                                }`}
                              >
                                ({ass.percentage}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default StudentMarks;
