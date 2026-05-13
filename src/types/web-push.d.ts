declare module "web-push" {
  type StoredPushSubscription = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: StoredPushSubscription,
      payload: string | Buffer,
      options?: { TTL?: number },
    ): Promise<unknown>;
  }

  const webpush: WebPush;
  export default webpush;
}
