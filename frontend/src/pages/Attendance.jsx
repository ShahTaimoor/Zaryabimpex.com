import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Coffee, 
  Users, 
  Calendar,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock3,
  User,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  useGetStatusQuery,
  useGetMyAttendanceQuery,
  useGetTeamAttendanceQuery,
  useClockInMutation,
  useClockOutMutation,
  useStartBreakMutation,
  useEndBreakMutation,
} from '../store/services/attendanceApi';
import { useGetEmployeesQuery } from '../store/services/employeesApi';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, LoadingButton } from '../components/LoadingSpinner';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { formatDate, formatTime } from '../utils/formatters';
import toast from 'react-hot-toast';

const Attendance = () => {
  const { user, hasPermission } = useAuth();
  const [viewMode, setViewMode] = useState('my'); // 'my' or 'team'
  const [showTeamView, setShowTeamView] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    employeeId: '',
    status: ''
  });
  const [notesIn, setNotesIn] = useState('');
  const [notesOut, setNotesOut] = useState('');

  // Check if user can view team attendance
  useEffect(() => {
    if (hasPermission('view_team_attendance')) {
      setShowTeamView(true);
    }
  }, [hasPermission]);

  // Fetch current status
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus, error: statusError } = useGetStatusQuery(
    undefined,
    {
      pollingInterval: 30000, // Refetch every 30 seconds
    }
  );

  useEffect(() => {
    if (statusError) {
      handleApiError(statusError, 'Failed to fetch attendance status');
    }
  }, [statusError]);

  const currentSession = statusData?.data;

  // Fetch my attendance
  const { data: myAttendanceData, isLoading: myAttendanceLoading, refetch: refetchMyAttendance, error: myAttendanceError } = useGetMyAttendanceQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: 50
    },
    {
      skip: viewMode !== 'my',
    }
  );

  useEffect(() => {
    if (myAttendanceError) {
      handleApiError(myAttendanceError, 'Failed to fetch attendance');
    }
  }, [myAttendanceError]);

  // Fetch team attendance for table (with filters) - only when in team view
  const { data: teamAttendanceDataFiltered, isLoading: teamAttendanceLoading, refetch: refetchTeamAttendance, error: teamAttendanceError } = useGetTeamAttendanceQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      employeeId: filters.employeeId || undefined,
      status: filters.status || undefined,
      limit: 50
    },
    {
      skip: viewMode !== 'team' || !hasPermission('view_team_attendance'),
    }
  );

  // Fetch team attendance for stats calculation (always today, for users with permission)
  const today = new Date().toISOString().split('T')[0];
  const { data: teamAttendanceDataForStats } = useGetTeamAttendanceQuery(
    {
      startDate: today,
      endDate: today,
      limit: 200 // Get all today's records for stats
    },
    {
      skip: !hasPermission('view_team_attendance'), // Only fetch if user has permission
    }
  );

  // Use filtered data for table display
  const teamAttendanceData = teamAttendanceDataFiltered;

  useEffect(() => {
    if (teamAttendanceError) {
      handleApiError(teamAttendanceError, 'Failed to fetch team attendance');
    }
  }, [teamAttendanceError]);

  // Fetch employees for team view filter and stats calculation
  const { data: employeesDataResponse } = useGetEmployeesQuery(
    { limit: 100, status: 'active' },
    {
      skip: !hasPermission('view_team_attendance'), // Load employees if user has permission, for stats calculation
    }
  );

  const employeesData = employeesDataResponse?.data?.employees || employeesDataResponse?.employees || [];

  // Clock in mutation
  const [clockInMutation, { isLoading: clockInLoading }] = useClockInMutation();

  // Clock out mutation
  const [clockOutMutation, { isLoading: clockOutLoading }] = useClockOutMutation();

  // Start break mutation
  const [startBreakMutation, { isLoading: startBreakLoading }] = useStartBreakMutation();

  // End break mutation
  const [endBreakMutation, { isLoading: endBreakLoading }] = useEndBreakMutation();

  const handleClockIn = async () => {
    try {
      await clockInMutation({
        notesIn: notesIn.trim() || undefined
      }).unwrap();
      showSuccessToast('Clocked in successfully');
      setNotesIn('');
      refetchStatus();
      refetchMyAttendance();
    } catch (error) {
      handleApiError(error, 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOutMutation({
        notesOut: notesOut.trim() || undefined
      }).unwrap();
      showSuccessToast('Clocked out successfully');
      setNotesOut('');
      refetchStatus();
      refetchMyAttendance();
    } catch (error) {
      handleApiError(error, 'Failed to clock out');
    }
  };

  const handleStartBreak = async (type = 'break') => {
    try {
      await startBreakMutation({ type }).unwrap();
      showSuccessToast('Break started');
      refetchStatus();
    } catch (error) {
      handleApiError(error, 'Failed to start break');
    }
  };

  const handleEndBreak = async () => {
    try {
      await endBreakMutation().unwrap();
      showSuccessToast('Break ended');
      refetchStatus();
    } catch (error) {
      handleApiError(error, 'Failed to end break');
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const calculateCurrentDuration = (clockInAt) => {
    if (!clockInAt) return 0;
    const now = new Date();
    const clockIn = new Date(clockInAt);
    const diffMs = now - clockIn;
    const totalBreakMinutes = currentSession?.breaks?.reduce((sum, b) => {
      if (b.endedAt) {
        return sum + (b.durationMinutes || 0);
      } else {
        // Active break - calculate current duration
        const breakStart = new Date(b.startedAt);
        const breakMs = now - breakStart;
        return sum + Math.round(breakMs / 60000);
      }
    }, 0) || 0;
    const workedMs = diffMs - (totalBreakMinutes * 60000);
    return Math.max(0, Math.round(workedMs / 60000));
  };

  const getActiveBreak = () => {
    return currentSession?.breaks?.find(b => !b.endedAt);
  };

  const attendanceList = viewMode === 'my' 
    ? (myAttendanceData?.data || [])
    : (teamAttendanceData?.data || []);

  const isLoading = viewMode === 'my' ? myAttendanceLoading : teamAttendanceLoading;

  // Calculate weekly hours (for current week) - for "my" view
  const getWeeklyHours = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Use my attendance data for weekly hours calculation
    const myAttendance = myAttendanceData?.data || [];
    const weekRecords = myAttendance.filter(record => {
      const recordDate = new Date(record.clockInAt);
      return recordDate >= startOfWeek && record.status === 'closed';
    });
    
    const totalMinutes = weekRecords.reduce((sum, record) => {
      return sum + (record.totalMinutes || 0);
    }, 0);
    
    // Add current session if active
    if (currentSession && viewMode === 'my') {
      const currentMinutes = calculateCurrentDuration(currentSession.clockInAt);
      return totalMinutes + currentMinutes;
    }
    
    return totalMinutes;
  };

  const weeklyHours = getWeeklyHours();
  const weeklyHoursDisplay = (weeklyHours / 60).toFixed(1);

  // Calculate team present (active employees today) - uses team attendance data
  const getTeamPresent = () => {
    if (!hasPermission('view_team_attendance') || !teamAttendanceDataForStats?.data) {
      return 0;
    }
    
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    // Get unique employees who clocked in today with open sessions
    const allTeamAttendance = teamAttendanceDataForStats.data || [];
    const todayOpenSessions = allTeamAttendance.filter(record => {
      const recordDate = new Date(record.clockInAt);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === todayDate.getTime() && record.status === 'open';
    });
    
    const uniqueEmployees = new Set(todayOpenSessions.map(r => r.employee?._id || r.employee));
    return uniqueEmployees.size;
  };

  // Calculate total active employees (for team present percentage)
  const totalActiveEmployees = employeesData?.length || 0;
  const teamPresent = getTeamPresent();
  const teamPresentPercentage = totalActiveEmployees > 0 
    ? Math.round((teamPresent / totalActiveEmployees) * 100) 
    : 0;

  // Calculate late arrivals (employees who clocked in after 9 AM today) - uses team attendance data
  const getLateArrivals = () => {
    if (!hasPermission('view_team_attendance') || !teamAttendanceDataForStats?.data) {
      return 0;
    }
    
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const expectedStartTime = new Date(todayDate);
    expectedStartTime.setHours(9, 0, 0, 0); // 9 AM expected start
    
    const allTeamAttendance = teamAttendanceDataForStats.data || [];
    const todayRecords = allTeamAttendance.filter(record => {
      const recordDate = new Date(record.clockInAt);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === todayDate.getTime();
    });
    
    const lateCount = todayRecords.filter(record => {
      const clockInTime = new Date(record.clockInAt);
      return clockInTime > expectedStartTime;
    }).length;
    
    return lateCount;
  };

  const lateArrivals = getLateArrivals();

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8 bg-gray-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center">
            <div className="bg-primary-100 p-2 rounded-lg mr-4">
              <Clock className="h-7 w-7 text-primary-600" />
            </div>
            Workforce Attendance
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage clock-ins, breaks, and workforce efficiency</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              if (viewMode === 'my') refetchMyAttendance();
              else refetchTeamAttendance();
              refetchStatus();
            }}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${statusLoading || isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Clocking and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Clocking Card */}
        <div className="lg:col-span-4 h-full">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <Clock3 className="h-5 w-5 mr-2 text-primary-500" />
                Time Control
              </h2>
            </div>
            
            <div className="p-8 flex-1 flex flex-col justify-center items-center text-center">
              {statusLoading ? (
                <div className="py-12"><LoadingSpinner /></div>
              ) : currentSession ? (
                <div className="w-full space-y-8">
                  <div className="space-y-2">
                    <div className="text-4xl font-black text-slate-900 tracking-tighter animate-in fade-in zoom-in duration-300">
                      {formatDuration(calculateCurrentDuration(currentSession.clockInAt))}
                    </div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full inline-block">
                      Active Shift Since {formatTime(currentSession.clockInAt)}
                    </p>
                  </div>

                  {getActiveBreak() ? (
                    <div className="p-5 bg-amber-50 rounded-xl border border-amber-200 animate-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-amber-100 rounded-lg">
                            <Coffee className="h-5 w-5 text-amber-600" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-amber-900 capitalize">{getActiveBreak().type} Period</p>
                            <p className="text-xs text-amber-700 font-medium">Started {formatTime(getActiveBreak().startedAt)}</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleEndBreak}
                        disabled={endBreakLoading}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg transition-all shadow-md shadow-amber-200/50 flex items-center justify-center space-x-2"
                      >
                        {endBreakLoading ? <LoadingSpinner size="sm" /> : <>
                          <LogOut className="h-4 w-4" />
                          <span>Resume Work</span>
                        </>}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
                      <button
                        onClick={() => handleStartBreak('break')}
                        disabled={startBreakLoading}
                        className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all group"
                      >
                        <Coffee className="h-6 w-6 text-slate-400 group-hover:text-primary-600 mx-auto mb-2" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider group-hover:text-slate-900">Break</span>
                      </button>
                      <button
                        onClick={() => handleStartBreak('lunch')}
                        disabled={startBreakLoading}
                        className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all group"
                      >
                        <TrendingUp className="h-6 w-6 text-slate-400 group-hover:text-primary-600 mx-auto mb-2" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider group-hover:text-slate-900">Lunch</span>
                      </button>
                    </div>
                  )}

                  <div className="pt-8 border-t border-slate-100">
                    <textarea
                      value={notesOut}
                      onChange={(e) => setNotesOut(e.target.value)}
                      placeholder="Shift handover notes (optional)..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm mb-4 resize-none h-24"
                    />
                    <button
                      onClick={handleClockOut}
                      disabled={clockOutLoading}
                      className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-slate-200 flex items-center justify-center space-x-3"
                    >
                      {clockOutLoading ? <LoadingSpinner size="sm" /> : <>
                        <LogOut className="h-5 w-5" />
                        <span className="text-base uppercase tracking-widest">End Session</span>
                      </>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-6 animate-in fade-in duration-500">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Clock className="h-10 w-10 text-slate-300" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Offline</h3>
                    <p className="text-sm font-medium text-slate-500">Ready to start your work day?</p>
                  </div>

                  <textarea
                    value={notesIn}
                    onChange={(e) => setNotesIn(e.target.value)}
                    placeholder="Clock in notes (optional)..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm resize-none h-24"
                  />

                  <button
                    onClick={handleClockIn}
                    disabled={clockInLoading}
                    className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-200/50 flex items-center justify-center space-x-3"
                  >
                    {clockInLoading ? <LoadingSpinner size="sm" /> : <>
                      <LogIn className="h-5 w-5" />
                      <span className="text-base uppercase tracking-widest">Clock In Now</span>
                    </>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance List and Stats */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Weekly Hours</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{weeklyHoursDisplay} hrs</h3>
              <p className={`text-[10px] font-bold mt-2 uppercase flex items-center ${
                weeklyHours >= 35 * 60 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                <TrendingUp className="h-3 w-3 mr-1" /> 
                {weeklyHours >= 35 * 60 ? 'On Track' : 'In Progress'}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Team Present</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {teamPresent} {totalActiveEmployees > 0 ? `/ ${totalActiveEmployees}` : ''}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">
                {teamPresentPercentage}% Occupancy
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Late Arrivals</p>
              <h3 className={`text-2xl font-black tracking-tight ${lateArrivals > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {lateArrivals}
              </h3>
              <p className={`text-[10px] font-bold mt-2 uppercase flex items-center ${
                lateArrivals > 0 ? 'text-rose-500' : 'text-emerald-600'
              }`}>
                {lateArrivals > 0 ? (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" /> Attention needed
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" /> All on time
                  </>
                )}
              </p>
            </div>
          </div>

          {/* View Toggle and Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex bg-slate-200/50 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setViewMode('my')}
                  className={`flex items-center space-x-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                    viewMode === 'my' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>My Log</span>
                </button>
                {showTeamView && (
                  <button
                    onClick={() => setViewMode('team')}
                    className={`flex items-center space-x-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                      viewMode === 'team' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Company View</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <span className="text-slate-400 text-xs font-bold">to</span>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
            </div>

            {viewMode === 'team' && (
              <div className="p-4 grid grid-cols-2 gap-4 border-b border-slate-100 bg-white">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    value={filters.employeeId}
                    onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="">All Personnel</option>
                    {employeesData?.map((emp) => (
                      <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} {emp.employeeId && `(${emp.employeeId})`}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="">All Statuses</option>
                    <option value="open">Currently Active</option>
                    <option value="closed">Past Sessions</option>
                  </select>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="py-20 text-center"><LoadingSpinner /></div>
              ) : attendanceList.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <Calendar className="h-10 w-10 mx-auto mb-4 opacity-20" />
                  <p className="font-bold uppercase tracking-widest text-[10px]">No logs found for this period</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {viewMode === 'team' && (
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Personnel</th>
                      )}
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Check-In/Out</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Duration</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceList.map((record) => (
                      <tr key={record._id} className="hover:bg-slate-50 transition-colors group">
                        {viewMode === 'team' && (
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                {record.employee?.firstName?.[0] || record.user?.firstName?.[0]}{record.employee?.lastName?.[0] || record.user?.lastName?.[0]}
                              </div>
                              <div className="text-sm font-bold text-slate-900">
                                {record.employee?.firstName || record.user?.firstName} {record.employee?.lastName || record.user?.lastName}
                                {record.employee?.employeeId && (
                                  <span className="text-[10px] font-bold text-slate-400 ml-2">({record.employee.employeeId})</span>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{formatDate(record.clockInAt)}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">System Ref: {record._id.slice(-8)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">In</span>
                              <span className="text-sm font-bold text-slate-700">{formatTime(record.clockInAt)}</span>
                            </div>
                            <div className="h-px w-4 bg-slate-200 mt-2" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">Out</span>
                              <span className="text-sm font-bold text-slate-700">
                                {record.clockOutAt ? formatTime(record.clockOutAt) : '---'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-black text-slate-900">
                            {record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : '--'}
                          </div>
                          {record.breaks?.length > 0 && (
                            <div className="text-[10px] font-bold text-amber-600 uppercase flex items-center justify-end">
                              <Coffee className="h-3 w-3 mr-1" /> {record.breaks.length} Breaks
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                record.status === 'open'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {record.status === 'open' ? 'Active' : 'Closed'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;

