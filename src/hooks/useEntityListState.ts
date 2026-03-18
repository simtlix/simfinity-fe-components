import * as React from "react";
import type { GridFilterModel } from "@mui/x-data-grid";
import { gridFilterModelToFilterItems } from "../lib/filterUtils";
import type { FilterItem } from "../lib/simfinityClient";

export type SortModelItem = { field: string; sort: 'asc' | 'desc' };

export type UseEntityListStateOptions = {
  getSearchParams?: () => URLSearchParams;
  onSearchParamsChange?: (params: URLSearchParams) => void;
};

export type UseEntityListStateResult = {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  rowsPerPage: number;
  setRowsPerPage: React.Dispatch<React.SetStateAction<number>>;
  sortModel: SortModelItem[];
  setSortModel: React.Dispatch<React.SetStateAction<SortModelItem[]>>;
  filterModel: GridFilterModel;
  setFilterModel: React.Dispatch<React.SetStateAction<GridFilterModel>>;
  pendingFilterModel: GridFilterModel;
  setPendingFilterModel: React.Dispatch<React.SetStateAction<GridFilterModel>>;
  filterItems: FilterItem[];
  sortTerms: { field: string; order: 'ASC' | 'DESC' }[];
  updateURL: (updates: {
    page?: number | null;
    size?: number | null;
    sort?: SortModelItem[] | null;
    filter?: GridFilterModel | null;
  }) => void;
};

export function useEntityListState(options: UseEntityListStateOptions = {}): UseEntityListStateResult {
  const { getSearchParams, onSearchParamsChange } = options;

  const searchParams = React.useMemo(() => {
    if (getSearchParams) return getSearchParams();
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search);
    return new URLSearchParams();
  }, [getSearchParams]);

  const searchParamsString = React.useMemo(() => searchParams.toString(), [searchParams]);

  const [page, setPage] = React.useState<number>(() => {
    const pageParam = searchParams.get('page');
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) return pageNum - 1;
    }
    return 0;
  });

  const [rowsPerPage, setRowsPerPage] = React.useState<number>(() => {
    const sizeParam = searchParams.get('size');
    if (sizeParam) {
      const sizeNum = parseInt(sizeParam, 10);
      if (!isNaN(sizeNum) && [5, 10, 25, 50].includes(sizeNum)) return sizeNum;
    }
    return 10;
  });

  const [sortModel, setSortModel] = React.useState<SortModelItem[]>(() => {
    const sortParam = searchParams.get('sort');
    if (sortParam) {
      try {
        return sortParam.split(',').map((item) => {
          const [field, sort] = item.split(':');
          return { field, sort: sort as 'asc' | 'desc' };
        });
      } catch {
        /* skip invalid */
      }
    }
    return [];
  });

  const initialFilterModel = React.useMemo(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam) {
      try {
        const fm = JSON.parse(filterParam);
        if (fm && Array.isArray(fm.items)) return fm;
      } catch {
        /* skip invalid */
      }
    }
    return { items: [] };
  }, [searchParamsString]);

  const [filterModel, setFilterModel] = React.useState<GridFilterModel>(initialFilterModel);
  const [pendingFilterModel, setPendingFilterModel] = React.useState<GridFilterModel>(initialFilterModel);

  const filterItems = React.useMemo(() => gridFilterModelToFilterItems(filterModel), [filterModel]);

  const sortTerms = React.useMemo(
    () => sortModel.map(s => ({ field: s.field, order: (s.sort === 'asc' ? 'ASC' : 'DESC') as 'ASC' | 'DESC' })),
    [sortModel]
  );

  const updateURL = React.useCallback((updates: {
    page?: number | null;
    size?: number | null;
    sort?: SortModelItem[] | null;
    filter?: GridFilterModel | null;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.page !== undefined) {
      if (updates.page === null || updates.page === 0) params.delete('page');
      else params.set('page', String(updates.page + 1));
    }
    if (updates.size !== undefined) {
      if (updates.size === null || updates.size === 10) params.delete('size');
      else params.set('size', String(updates.size));
    }
    if (updates.sort !== undefined) {
      if (updates.sort === null || updates.sort.length === 0) params.delete('sort');
      else params.set('sort', updates.sort.map(s => `${s.field}:${s.sort}`).join(','));
    }
    if (updates.filter !== undefined) {
      if (updates.filter === null || updates.filter.items.length === 0) params.delete('filter');
      else params.set('filter', JSON.stringify(updates.filter));
    }

    if (onSearchParamsChange) { onSearchParamsChange(params); }
    else if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [searchParamsString, onSearchParamsChange]);

  React.useEffect(() => {
    const pageParam = searchParams.get('page');
    const sizeParam = searchParams.get('size');
    const sortParam = searchParams.get('sort');
    const filterParam = searchParams.get('filter');

    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) setPage(pageNum - 1);
    }
    if (sizeParam) {
      const sizeNum = parseInt(sizeParam, 10);
      if (!isNaN(sizeNum) && [5, 10, 25, 50].includes(sizeNum)) setRowsPerPage(sizeNum);
    }
    if (sortParam) {
      try {
        const sortItems = sortParam.split(',').map(item => {
          const [field, sort] = item.split(':');
          return { field, sort: sort as 'asc' | 'desc' };
        });
        setSortModel(sortItems);
      } catch { /* skip invalid */ }
    }
    if (filterParam) {
      try {
        const fm = JSON.parse(filterParam);
        setFilterModel(fm);
        setPendingFilterModel(fm);
      } catch { /* skip invalid */ }
    }
  }, [searchParamsString]);

  React.useEffect(() => { updateURL({ page, size: rowsPerPage }); }, [page, rowsPerPage, updateURL]);
  React.useEffect(() => { updateURL({ sort: sortModel }); }, [sortModel, updateURL]);
  React.useEffect(() => { updateURL({ filter: filterModel }); }, [filterModel, updateURL]);

  return {
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    sortModel,
    setSortModel,
    filterModel,
    setFilterModel,
    pendingFilterModel,
    setPendingFilterModel,
    filterItems,
    sortTerms,
    updateURL,
  };
}
