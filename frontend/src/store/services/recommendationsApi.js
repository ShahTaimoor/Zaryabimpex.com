import { api } from '../api';

export const recommendationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    generateRecommendations: builder.mutation({
      query: (data) => ({
        url: 'recommendations/generate',
        method: 'post',
        data,
      }),
    }),
    getRecommendation: builder.query({
      query: (id) => ({
        url: `recommendations/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Settings', id: `RECOMMENDATION_${id}` }],
    }),
    trackInteraction: builder.mutation({
      query: ({ recommendationId, ...data }) => ({
        url: `recommendations/${recommendationId}/interactions`,
        method: 'post',
        data,
      }),
    }),
    trackBehavior: builder.mutation({
      query: (data) => ({
        url: 'recommendations/behavior',
        method: 'post',
        data,
      }),
    }),
    getPerformance: builder.query({
      query: (params) => ({
        url: 'recommendations/performance',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'RECOMMENDATIONS_PERFORMANCE' }],
    }),
    getUserRecommendations: builder.query({
      query: ({ userId, ...params }) => ({
        url: `recommendations/user/${userId}`,
        method: 'get',
        params,
      }),
      providesTags: (_r, _e, { userId }) => [{ type: 'Settings', id: `USER_RECOMMENDATIONS_${userId}` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGenerateRecommendationsMutation,
  useGetRecommendationQuery,
  useTrackInteractionMutation,
  useTrackBehaviorMutation,
  useGetPerformanceQuery,
  useGetUserRecommendationsQuery,
} = recommendationsApi;

