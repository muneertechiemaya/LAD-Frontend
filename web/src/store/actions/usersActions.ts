import {
  setUsers,
  setUsersLoading,
  setUsersError,
  clearUsersError,
  selectUsersCacheValid
} from '../slices/usersSlice';
import { logger } from '@/lib/logger';
import { getAllUsers } from '../../services/userService';
import { AppDispatch, RootState } from '../store';
import { User } from '../slices/usersSlice';
// Thunk type
type AppThunk = (dispatch: AppDispatch, getState: () => RootState) => Promise<void> | void;
// ============ USERS ACTIONS ============
// Fetch users with cache management
export const fetchUsersAction = (): AppThunk => async (dispatch, getState) => {
  const state = getState();
  // Check cache validity
  const cacheValid = selectUsersCacheValid(state);
  if (cacheValid) {
    logger.debug('[Redux] Users cache valid, skipping fetch');
    return;
  }
  try {
    dispatch(setUsersLoading(true));
    dispatch(clearUsersError());
    logger.debug('[Redux] Fetching users from API...');
    const users = await getAllUsers();
    dispatch(setUsers(users as User[]));
    logger.debug('[Redux] Users loaded successfully', { count: (users as User[])?.length || 0 });
  } catch (error) {
    const err = error as Error;
    logger.error('[Redux] Failed to fetch users', error);
    dispatch(setUsersError(err.message || 'Failed to fetch users'));
  } finally {
    dispatch(setUsersLoading(false));
  }
};
