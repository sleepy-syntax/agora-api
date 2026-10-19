export interface IPublicStats {
    waitingNow: number;
    liveSessions: number;
    conversationsToday: number;
    conversationsAllTime: number;
    averageDurationSeconds: number;
    averageRating: number | null;
    ratingCount: number;
}
