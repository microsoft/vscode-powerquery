export function debounce<F extends (...args: never) => void>(fn: F, timeout: number): F;

export function debounce<This, Parameters extends unknown[]>(
    fn: (this: This, ...args: Parameters) => void,
    timeout: number,
): (this: This, ...args: Parameters) => void {
    let _args: Parameters;
    let _this: This;

    let triggerId: ReturnType<typeof setTimeout>;

    return startTimer;

    function startTimer(this: This, ...args: Parameters): void {
        _args = args;
        // eslint-disable-next-line no-invalid-this, @typescript-eslint/no-this-alias
        _this = this;
        clearTimeout(triggerId);
        triggerId = setTimeout(execute, timeout);
    }

    function execute(): void {
        fn.apply(_this, _args);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NoInfer<T> = [T][T extends any ? 0 : never];

export function partitionFn<This, Parameters extends unknown[], ReturnType>(
    fnGenerator: (this: NoInfer<This>, ...args: NoInfer<Parameters>) => (this: This, ...args: Parameters) => ReturnType,
    keyGenerator: (this: This, ...args: Parameters) => unknown,
): (this: This, ...args: Parameters) => ReturnType {
    const cache: Map<unknown, (this: This, ...args: Parameters) => ReturnType> = new Map<
        unknown,
        (this: This, ...args: Parameters) => ReturnType
    >();

    return function (this: This, ...args: Parameters): ReturnType {
        // eslint-disable-next-line no-invalid-this
        const key: unknown = keyGenerator.apply(this, args);

        // Attempt to reuse a pre-generated function
        const fn: ((this: This, ...args: Parameters) => ReturnType) | undefined = cache.get(key);

        if (fn) {
            // eslint-disable-next-line no-invalid-this
            return fn.apply(this, args);
        } else {
            // Otherwise, make a new one and cache it
            // eslint-disable-next-line no-invalid-this
            const fn: (this: This, ...args: Parameters) => ReturnType = fnGenerator.apply(this, args);
            cache.set(key, fn);

            // eslint-disable-next-line no-invalid-this
            return fn.apply(this, args);
        }
    };
}
