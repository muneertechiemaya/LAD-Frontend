# Apollo Leads Feature - Frontend

**Production-Grade Frontend Structure for Apollo.io Integration**

## 📁 Structure

```
frontend/features/apollo-leads/
├── index.ts                          # Central export point
├── manifest.json                     # Feature metadata & configuration
├── types/
│   └── apollo.types.ts              # TypeScript definitions
├── services/
│   ├── apolloLeadsService.ts        # Main API service
│   └── apolloPhoneService.ts        # Phone reveal service
├── hooks/
│   ├── useApolloLeads.ts            # Main feature hook
│   ├── useApolloSearch.ts           # Search hook (TODO)
│   └── useApolloCredits.ts          # Credits tracking hook (TODO)
├── components/
│   ├── ApolloCompanyCard.tsx        # Company display (TODO)
│   └── ApolloEmployeeList.tsx       # Employee list (TODO)
└── README.md                         # This file
```

## 🚀 Usage

### Basic Import

```typescript
import { 
  apolloLeadsService,
  useApolloLeads,
  type ApolloCompany,
  type ApolloSearchParams
} from '@/features/apollo-leads';
```

### Using the Service

```typescript
import { apolloLeadsService } from '@/features/apollo-leads';

// Search for companies
const results = await apolloLeadsService.searchCompanies({
  query: 'healthcare technology',
  location: 'Dubai',
  employee_count_min: 50,
  limit: 25
});

// Get company details
const company = await apolloLeadsService.getCompanyDetails('comp_123');

// Search employees
const employees = await apolloLeadsService.searchEmployees({
  company_name: 'HealthTech Solutions',
  titles: ['CEO', 'CTO'],
  seniority: ['VP', 'C-Level']
});

// Reveal contact info (costs credits)
const email = await apolloLeadsService.revealEmail('person_123'); // 1 credit
const phone = await apolloLeadsService.revealPhone('person_123'); // 8 credits
```

### Using the Hook

```typescript
import { useApolloLeads } from '@/features/apollo-leads';

function MyComponent() {
  const { 
    searchCompanies, 
    loading, 
    error, 
    credits 
  } = useApolloLeads();

  const handleSearch = async () => {
    const results = await searchCompanies({
      query: 'fintech startups',
      location: 'UAE'
    });
    console.log('Found companies:', results);
  };

  return (
    <div>
      <p>Credits: {credits?.available}</p>
      <button onClick={handleSearch} disabled={loading}>
        Search
      </button>
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## 💰 Credit Costs

| Operation | Credits | Description |
|-----------|---------|-------------|
| Company Search | 1 | Search for companies |
| Email Reveal | 1 | Reveal person's email |
| Phone Reveal | 8 | Reveal person's phone |

## 🎯 Feature Tiers

| Tier | Enabled | Credits | Notes |
|------|---------|---------|-------|
| Free | ❌ | 0 | Upgrade required |
| Basic | ❌ | 0 | Upgrade required |
| Premium | ✅ | 1,000 | Full access |
| Enterprise | ✅ | 10,000 | Full access |

## 🔌 Backend Integration

This frontend feature connects to:

```
Backend: /backend/features/apollo-leads/
Endpoints:
  - POST /api/apollo-leads/search
  - GET /api/apollo-leads/leads/:id/email
  - GET /api/apollo-leads/leads/:id/phone
  - GET /api/apollo-leads/health
```

## 📝 TypeScript Support

Full TypeScript definitions included:

```typescript
import type {
  ApolloCompany,
  ApolloPerson,
  ApolloSearchParams,
  ApolloSearchResponse,
  ApolloCredits,
  UseApolloLeadsReturn
} from '@/features/apollo-leads';
```

## 🔒 Authentication

All API calls automatically include JWT authentication:

```typescript
// Token is automatically retrieved from localStorage
const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
headers: {
  'Authorization': `Bearer ${token}`
}
```

## ⚠️ Error Handling

The service handles various error scenarios:

```typescript
try {
  await apolloLeadsService.searchCompanies(params);
} catch (error) {
  // 401: Authentication required
  // 402: Insufficient credits
  // 403: Feature not available (upgrade required)
  // 404: Resource not found
  // 500: Server error
  console.error(error.message);
}
```

## 🔄 Migration from Old Structure

### Old Import (lad_ui)
```typescript
import { apolloLeadsService } from '@/services/apolloLeadsService';
```

### New Import (frontend/features)
```typescript
import { apolloLeadsService } from '@/features/apollo-leads';
```

The new service maintains backward compatibility while adding:
- ✅ Full TypeScript support
- ✅ Better error handling
- ✅ Consistent API
- ✅ Credit cost tracking
- ✅ Feature flag integration

## 🧪 Testing

### Health Check
```typescript
const health = await apolloLeadsService.checkHealth();
console.log('Status:', health.status); // 'healthy' | 'degraded' | 'down'
```

### Check Credits
```typescript
const { credits } = useApolloLeads();
console.log('Available:', credits?.available);
console.log('Used:', credits?.used);
```

## 📚 Related Documentation

- [Backend Apollo Feature](/backend/features/apollo-leads/)
- [Feature Flags Service](/backend/feature_flags/)
- [API Documentation](/backend/features/apollo-leads/routes.js)
- [Testing Guide](/Apollo feature testing)

## 🎯 Roadmap

- [ ] Complete `useApolloSearch` hook
- [ ] Complete `useApolloCredits` hook
- [ ] Create `ApolloCompanyCard` component
- [ ] Create `ApolloEmployeeList` component
- [ ] Add real-time credit updates
- [ ] Add search result caching
- [ ] Add export to CSV functionality
- [ ] Add bulk operations support

## 💡 Best Practices

1. **Always check credits before expensive operations**
   ```typescript
   const { canAfford } = useApolloCredits();
   if (canAfford('phone_reveal')) {
     await revealPhone(personId);
   }
   ```

2. **Handle errors gracefully**
   ```typescript
   try {
     await searchCompanies(params);
   } catch (error) {
     if (error.message.includes('Insufficient credits')) {
       // Show upgrade modal
     }
   }
   ```

3. **Use TypeScript types**
   ```typescript
   const params: ApolloSearchParams = {
     query: 'tech startups',
     limit: 50
   };
   ```

4. **Leverage the hook for state management**
   ```typescript
   const { loading, error, credits } = useApolloLeads();
   ```

---

**Note:** This is part of the production-grade SaaS architecture migration. All new development should use this feature-based structure instead of the old `lad_ui/src/services/` approach.
