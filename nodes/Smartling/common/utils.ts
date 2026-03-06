export const sleep = (ms: number) => (new Promise(resolve => {
    setTimeout(resolve, ms);
}));

export const isValidURL = (str: string): boolean => {
    try {
        const _ = new URL(str);
        return true;
    } catch {
        return false;
    }
};

export const toStringArray = (values: string | string[]): string[] => Array.isArray(values)
    ? values
    : values.split(",").map(value => value.trim());

export interface PollOptions<T> {
    initialDelay?: number;
    delayBetweenAttempts: number;
    maxDuration: number;
    exitCondition: (result: T) => boolean;
    log?: (msg: string) => void;
    returnLastOnTimeout?: boolean;
}

export const pollUntil = async <T>(
    fn: () => Promise<T>,
    options: PollOptions<T>
): Promise<T> => {
    const {
        initialDelay = 0,
        delayBetweenAttempts,
        maxDuration,
        returnLastOnTimeout,
        exitCondition,
        log
    } = options;

    const startTime = Date.now();
    const deadline = startTime + maxDuration;

    if (initialDelay > 0) {
        await new Promise(resolve => {
            setTimeout(resolve, initialDelay);
        });
    }

    let attempt = 0;
    let lastResult: T | undefined;

    while (Date.now() < deadline) {
        attempt++;

        try {
            const result = await fn();
            lastResult = result;

            if (exitCondition(result)) {
                if (log) {
                    log(`[poll] succeeded after ${attempt} attempts in ${Date.now() - startTime}ms`);
                }
                return result;
            }

            if (log) {
                log(`[poll] attempt=${attempt} - condition not met, retrying...`);
            }
        } catch (err) {
            if (log) {
                log(`[poll] attempt=${attempt} error=${String(err)} - continuing...`);
            }
        }

        const timeLeft = deadline - Date.now();
        if (timeLeft <= 0) {
            break;
        }

        const delayTime = Math.min(delayBetweenAttempts, timeLeft);
        await new Promise(resolve => {
            setTimeout(resolve, delayTime);
        });
    }

    const elapsed = Date.now() - startTime;
    if (returnLastOnTimeout && lastResult !== undefined) {
        if (log) {
            log(`[poll] timed out after ${elapsed}ms (${attempt} attempts); exit condition not met, returning last result`);
        }

        return lastResult;
    }

    throw new Error(
        `Polling timed out after ${elapsed}ms (${attempt} attempts)${
            lastResult !== undefined ? "; last result did not meet exit condition" : ""
        }`
    );
};
