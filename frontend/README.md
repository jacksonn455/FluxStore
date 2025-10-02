# FluxStore: Product Management Frontend

A modern React-based frontend application for managing products with real-time data synchronization. This application provides an intuitive interface for uploading CSV files, browsing products with advanced filtering, and monitoring real-time data processing.

## Features

### Core Functionality

*   **CSV File Upload**: Drag-and-drop interface for uploading product data files.
*   **Real-time Processing Monitoring**: Live progress tracking during file processing.
*   **Advanced Product Table**: Comprehensive data browsing with pagination and sorting.
*   **Multi-currency Display**: Automatic currency conversion display (EUR, GBP, JPY, CAD, AUD, BRL).
*   **Responsive Design**: Optimized for desktop and mobile devices.

### User Experience

*   **Progress Indicators**: Real-time upload and processing status.
*   **Smart Polling**: Automatic data synchronization with optimized intervals.
*   **Error Handling**: Comprehensive error messages and recovery options.
*   **Filtering & Search**: Advanced filtering by name, price range, and expiration date.
*   **Sorting Options**: Multi-column sorting with ascending/descending order.

### Technical Features

*   **TypeScript**: Full type safety and better developer experience.
*   **Material-UI**: Modern, accessible component library.
*   **Real-time Updates**: Smart polling mechanism with configurable intervals.
*   **State Management**: Efficient React state management with hooks.
*   **API Integration**: Robust error handling and loading states.

## Technologies Used

| Category         | Technology                               |
| :--------------- | :--------------------------------------- |
| **Framework**    | React 18 with TypeScript                 |
| **UI Library**   | Material-UI (MUI) v5                     |
| **HTTP Client**  | Axios for API communication              |
| **Build Tool**   | Vite for fast development and building   |
| **State Management** | React Hooks (useState, useEffect, useCallback) |
| **Styling**      | Emotion (MUI's styling solution)         |
| **Icons**        | Material-UI Icons                        |
| **Development**  | ESLint, Prettier, TypeScript compiler    |

## Project Structure

```text
src/
├── components/
│   ├── FileUpload/
│   │   ├── FileUpload.tsx
│   │   └── FileUpload.test.tsx
│   ├── ProductTable/
│   │   ├── ProductTable.tsx
│   │   └── ProductTable.test.tsx
│   └── common/
│       ├── LoadingSpinner.tsx
│       └── ErrorMessage.tsx
├── services/
│   ├── api.ts
│   └── productService.ts
├── types/
│   └── index.ts
├── hooks/
│   ├── useProducts.ts
│   └── usePolling.ts
├── utils/
│   ├── formatters.ts
│   └── validators.ts
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

## Author

<img src="https://avatars1.githubusercontent.com/u/46221221?s=460&u=0d161e390cdad66e925f3d52cece6c3e65a23eb2&v=4" width=115>  

<sub>@jacksonn455</sub>