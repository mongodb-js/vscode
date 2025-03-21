export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;
