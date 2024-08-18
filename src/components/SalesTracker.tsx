import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../@/components/ui/table";
import { Input } from "../../@/components/ui/input";
import { Button } from "../../@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../@/components/ui/dropdown-menu";
import { ISale, IDofusItem } from '../types';
import { db, setupDatabase } from '../services/DatabaseService';

interface SalesTrackerProps {
  addCraftedItem: (item: IDofusItem | { name: string; ankama_id?: number }) => Promise<void>;
}

const ITEMS_PER_PAGE = 10;

const SalesTracker: React.FC<SalesTrackerProps> = ({ addCraftedItem }) => {
  const [sales, setSales] = useState<ISale[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [localValues, setLocalValues] = useState<{ [key: string]: string }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSold, setFilterSold] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalTurnover, setTotalTurnover] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initDatabase = async () => {
      try {
        await setupDatabase();
        await loadSales();
        await loadTotals();
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setError('Failed to initialize database. Please refresh the page and try again.');
      }
    };

    initDatabase();
  }, []);

  useEffect(() => {
    if (db.isOpen()) {
      loadSales();
      loadTotals();
    }
  }, [currentPage, searchTerm, filterSold]);

  const loadSales = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: Partial<ISale> = {};
      if (searchTerm) filters.itemName = searchTerm;
      if (filterSold !== null) filters.sellDate = filterSold ? new Date() : null;

      console.log('Fetching sales with filters:', filters);
      const { sales: loadedSales, total } = await db.getSales(currentPage, ITEMS_PER_PAGE, filters);
      console.log('Loaded sales:', loadedSales);
      console.log('Total sales:', total);

      setSales(loadedSales);
      setTotalSales(total);
    } catch (err) {
      console.error('Error loading sales:', err);
      setError('Failed to load sales. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  const loadTotals = async () => {
    try {
      const { totalProfit, totalTurnover } = await db.getTotalProfitAndTurnover();
      setTotalProfit(totalProfit);
      setTotalTurnover(totalTurnover);
    } catch (err) {
      console.error('Error loading totals:', err);
    }
  };
  const handleChange = (id: number, field: keyof ISale, value: string) => {
    setLocalValues(prev => ({
      ...prev,
      [`${id}-${field}`]: value
    }));
  };

  const handleBlur = async (id: number, field: keyof ISale) => {
    const value = localValues[`${id}-${field}`];
    if (value !== undefined) {
      let updatedValue: number | Date | null = null;
      if (field === 'sellDate') {
        updatedValue = value ? new Date(value) : null;
      } else if (field !== 'itemName' && field !== 'addedDate') {
        updatedValue = Number(value);
      }
      await db.updateSale(id, { [field]: updatedValue });
      loadSales();
      loadTotals();
    }
  };

  const handleDelete = async (id: number) => {
    await db.deleteSale(id);
    loadSales();
    loadTotals();
  };

  const handleDuplicate = async (sale: ISale) => {
    const { id, ...saleWithoutId } = sale;
    await db.addSale({
      ...saleWithoutId,
      addedDate: new Date()
    });
    loadSales();
    loadTotals();
  };

  const handleAddToCraftimizer = (itemName: string) => {
    addCraftedItem({ name: itemName });
  };

  const formatDate = (date: Date | string | undefined | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString();
  };

  const totalPages = Math.ceil(totalSales / ITEMS_PER_PAGE);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }
  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden bg-background text-foreground">
      <div className="flex-shrink-0">
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 bg-background text-foreground border-input"
          />
          <Button
            onClick={() => setFilterSold(null)}
            variant={filterSold === null ? "default" : "outline"}
            className="bg-primary text-primary-foreground"
          >
            All
          </Button>
          <Button
            onClick={() => setFilterSold(true)}
            variant={filterSold === true ? "default" : "outline"}
            className="bg-primary text-primary-foreground"
          >
            Sold
          </Button>
          <Button
            onClick={() => setFilterSold(false)}
            variant={filterSold === false ? "default" : "outline"}
            className="bg-primary text-primary-foreground"
          >
            Unsold
          </Button>
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Sales Tracker</h2>
          <div>
            <span className="mr-4">Total Profit: {totalProfit.toFixed(0)}</span>
            <span>Total Turnover: {totalTurnover.toFixed(0)}</span>
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-auto">
        <div className="rounded-md border border-border">
          <Table className="table-custom">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Item Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Cost Price</TableHead>
                <TableHead>Sell Price</TableHead>
                <TableHead>Added Date</TableHead>
                <TableHead>Sell Date</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">No sales found</TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                  <TableCell>{sale.itemName}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={localValues[`${sale.id}-quantity`] ?? sale.quantity}
                      onChange={(e) => handleChange(sale.id!, 'quantity', e.target.value)}
                      onBlur={() => handleBlur(sale.id!, 'quantity')}
                      className="w-20 h-6 px-1 bg-background text-foreground border-input"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={localValues[`${sale.id}-costPrice`] ?? sale.costPrice}
                      onChange={(e) => handleChange(sale.id!, 'costPrice', e.target.value)}
                      onBlur={() => handleBlur(sale.id!, 'costPrice')}
                      className="w-24 h-6 px-1 bg-background text-foreground border-input"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={localValues[`${sale.id}-sellPrice`] ?? sale.sellPrice}
                      onChange={(e) => handleChange(sale.id!, 'sellPrice', e.target.value)}
                      onBlur={() => handleBlur(sale.id!, 'sellPrice')}
                      className="w-24 h-6 px-1 bg-background text-foreground border-input"
                    />
                  </TableCell>
                  <TableCell>{formatDate(sale.addedDate)}</TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={localValues[`${sale.id}-sellDate`] ?? (sale.sellDate ? new Date(sale.sellDate).toISOString().split('T')[0] : '')}
                      onChange={(e) => handleChange(sale.id!, 'sellDate', e.target.value)}
                      onBlur={() => handleBlur(sale.id!, 'sellDate')}
                      className="w-32 h-6 px-1 bg-background text-foreground border-input"
                    />
                  </TableCell>
                  <TableCell>{sale.profit.toFixed(0)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-secondary text-secondary-foreground">Actions</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-popover text-popover-foreground">
                        <DropdownMenuItem onClick={() => handleAddToCraftimizer(sale.itemName)}>
                          Add to Craftimizer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(sale)}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(sale.id!)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex justify-between items-center mt-4">
        <div>
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalSales)} of {totalSales} entries
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            variant="outline"
            size="sm"
          >
            Previous
          </Button>
          <Button
            onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            variant="outline"
            size="sm"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalesTracker;