# PokéVision

## Overview

PokéVision is a location intelligence platform that provides personalized geographic area feeds and community-driven insights. The application offers users the ability to request custom coverage for specific geographic areas at transparent pricing ($20 per 10 sq km). The platform features a modern React-based frontend with a dark theme and gold accents, designed as a single-page application with additional area request functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development patterns
- **Routing**: Wouter for lightweight client-side routing with two main routes (Home and RequestArea)
- **Styling**: Tailwind CSS with a custom dark theme using CSS variables for consistent theming
- **UI Components**: Shadcn/ui component library providing pre-built, accessible components with Radix UI primitives
- **State Management**: TanStack React Query for server state management and caching
- **Build Tool**: Vite for fast development and optimized production builds

### Design System
- **Theme**: Dark mode with gold accents inspired by gaming and tech platforms (Discord, Notion)
- **Color Palette**: Deep charcoal backgrounds with vibrant gold highlights for primary actions
- **Typography**: Inter font family with clear hierarchy and generous spacing
- **Component Library**: Comprehensive set of reusable UI components with consistent styling

### Backend Architecture
- **Server**: Express.js with TypeScript for API endpoints and middleware
- **Development Setup**: Hot module replacement and development middleware integration
- **API Structure**: RESTful endpoints with proper error handling and logging middleware
- **Storage Interface**: Abstracted storage layer with in-memory implementation for development

### Data Management
- **Database**: PostgreSQL configured through Drizzle ORM for type-safe database operations
- **Schema**: User management with username/password authentication structure
- **Migrations**: Drizzle Kit for database schema migrations and version control
- **Connection**: Neon Database serverless PostgreSQL for cloud deployment

### Key Features
- **Interactive Map Canvas**: Custom geofencing tool allowing users to draw squares, circles, and polygons to define coverage areas
- **Area Calculation**: Real-time area computation with cost estimation based on geometric shapes
- **Responsive Design**: Mobile-first approach with breakpoint-specific layouts
- **External Integrations**: Links to Discord community, demo platform, and Ko-Fi payment processing

### Development Workflow
- **TypeScript Configuration**: Strict type checking with path aliases for clean imports
- **Code Organization**: Modular component structure with shared utilities and hooks
- **Asset Management**: Static asset handling with proper optimization and caching

## External Dependencies

### Core Technologies
- **React Ecosystem**: React 18, React DOM, React Hook Form for form management
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer for modern CSS processing
- **UI Framework**: Radix UI primitives, Lucide React icons, Class Variance Authority for component variants

### Database & ORM
- **Database**: Neon Database (serverless PostgreSQL)
- **ORM**: Drizzle ORM with Drizzle Kit for migrations
- **Schema Validation**: Zod for runtime type validation and schema definitions

### Development Tools
- **Build**: Vite with React plugin and TypeScript support
- **Server**: Express.js with session management via connect-pg-simple
- **Development**: TSX for TypeScript execution, ESBuild for production builds

### External Services
- **Discord**: Community server integration (discord.gg/86pNbRzX4N)
- **Demo Platform**: Map demonstration at demo.pokevision.co.za
- **Live Platform**: Main map service at map.pokevision.co.za
- **Payment Processing**: Ko-Fi integration for subscription management
- **Deployment**: Replit hosting with development banner integration

### Utility Libraries
- **Date Handling**: date-fns for date manipulation and formatting
- **State Management**: TanStack React Query for API state management
- **Form Handling**: React Hook Form with Hookform Resolvers for validation
- **Canvas Manipulation**: Custom geofencing implementation with area calculations
- **Carousel**: Embla Carousel for image/content carousels