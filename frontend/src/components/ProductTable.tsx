import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  ReactNode,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Select,
  MenuItem,
  Button,
  Box,
  Pagination,
  Typography,
} from "@mui/material";
import api from "../services/api";
import { Product } from "../types";

interface ProductTableProps {
  onFetchError?: (error: string) => void;
  refreshTrigger?: number;
}

const ProductTable: React.FC<ProductTableProps> = ({
  onFetchError,
  refreshTrigger = 0,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [nameFilter, setNameFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [expiration, setExpiration] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(false);
  const [lastRefreshTrigger, setLastRefreshTrigger] = useState(refreshTrigger);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const fetchProducts = async (
    currentPage: number = page,
    currentLimit: number = limit
  ) => {
    const scrollPosition = tableContainerRef.current?.scrollTop;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: currentLimit.toString(),
        ...(nameFilter && { name: nameFilter }),
        ...(minPrice && { minPrice: minPrice }),
        ...(maxPrice && { maxPrice: maxPrice }),
        ...(expiration && { expiration: expiration }),
        ...(sortField && { sortField }),
        ...(sortOrder && { sortOrder }),
      });
      const response = await api.get(`/products?${params.toString()}`);
      setProducts(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
      setTotalProducts(response.data.pagination.total);
    } catch (err) {
      console.error("Fetch error:", err);
      if (onFetchError) onFetchError("Failed to fetch products.");
    } finally {
      setLoading(false);
      if (scrollPosition !== undefined && tableContainerRef.current) {
        tableContainerRef.current.scrollTop = scrollPosition;
      }
    }
  };

  useEffect(() => {
    if (refreshTrigger !== lastRefreshTrigger) {
      setLastRefreshTrigger(refreshTrigger);
      setPage(1);

      fetchProducts(1, limit);
    }
  }, [refreshTrigger, lastRefreshTrigger, limit]);

  useEffect(() => {
    let intervalTime = 10000;

    if (refreshTrigger !== lastRefreshTrigger) {
      intervalTime = 5000;
    }

    const pollInterval = setInterval(() => {
      fetchProducts(page, limit);
    }, intervalTime);

    return () => clearInterval(pollInterval);
  }, [
    page,
    limit,
    nameFilter,
    minPrice,
    maxPrice,
    expiration,
    sortField,
    sortOrder,
    refreshTrigger,
    lastRefreshTrigger,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [
    page,
    limit,
    nameFilter,
    minPrice,
    maxPrice,
    expiration,
    sortField,
    sortOrder,
  ]);

  const handleApplyFilters = () => {
    setPage(1);
  };

  const handleLimitChange = (
    event:
      | ChangeEvent<Omit<HTMLInputElement, "value"> & { value: number }>
      | (Event & { target: { value: number; name?: string } }),
    child: ReactNode
  ) => {
    const newLimit = (event.target as { value: number }).value;
    setLimit(newLimit);
    setPage(1);
  };

  if (loading) return <Typography>Loading products...</Typography>;

  return (
    <Paper elevation={3} className="product-table">
      <Typography variant="h6" gutterBottom>
        Products Table (Total Products: {totalProducts})
      </Typography>
      <Box
        className="filter-controls"
        sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}
      >
        <TextField
          label="Name"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          size="small"
        />
        <TextField
          label="Min Price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          type="number"
          size="small"
        />
        <TextField
          label="Max Price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          type="number"
          size="small"
        />
        <TextField
          label="Expiration (YYYY-MM-DD)"
          value={expiration}
          onChange={(e) => setExpiration(e.target.value)}
          size="small"
        />
        <Select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as string)}
          size="small"
        >
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="price">Price</MenuItem>
          <MenuItem value="expiration">Expiration</MenuItem>
        </Select>
        <Select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as string)}
          size="small"
        >
          <MenuItem value="asc">Ascending</MenuItem>
          <MenuItem value="desc">Descending</MenuItem>
        </Select>
        <Select value={limit} onChange={handleLimitChange} size="small">
          <MenuItem value={10}>10</MenuItem>
          <MenuItem value={20}>20</MenuItem>
          <MenuItem value={50}>50</MenuItem>
          <MenuItem value={100}>100</MenuItem>
        </Select>
        <Button variant="contained" onClick={handleApplyFilters} size="small">
          Apply
        </Button>
      </Box>
      <TableContainer component={Paper} ref={tableContainerRef}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Price (USD)</TableCell>
              <TableCell>Expiration</TableCell>
              <TableCell>Currencies (EUR, GBP, etc.)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product._id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.price}</TableCell>
                <TableCell>
                  {new Date(product.expiration).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {Object.entries(product.currencyConversions).map(
                    ([curr, val]) => (
                      <div key={curr}>
                        {curr}: {val}
                      </div>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {products.length === 0 && !loading && (
        <Typography sx={{ mt: 2 }}>No products found.</Typography>
      )}
      <Pagination
        count={totalPages}
        page={page}
        onChange={(_, value) => setPage(value)}
        className="pagination"
        sx={{ mt: 2, display: "flex", justifyContent: "center" }}
      />
    </Paper>
  );
};

export default ProductTable;
