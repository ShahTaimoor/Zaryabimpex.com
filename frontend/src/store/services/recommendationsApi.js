import { api } from '../api';

export const recommendationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    generateRecommendations: builder.mutation({
      query: (data) => ({
        url: 'recommendations/generate',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Reports', id: 'RECOMMENDATIONS_PERFORMANCE' },
      ],
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
      invalidatesTags: (_r, _e, { recommendationId }) => {
        const tags = [{ type: 'Reports', id: 'RECOMMENDATIONS_PERFORMANCE' }];
        if (recommendationId) tags.push({ type: 'Settings', id: `RECOMMENDATION_${recommendationId}` });
        return tags;
      },
    }),
    trackBehavior: builder.mutation({
      query: (data) => ({
        url: 'recommendations/behavior',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Reports', id: 'RECOMMENDATIONS_PERFORMANCE' },
      ],
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

