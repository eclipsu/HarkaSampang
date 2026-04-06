export default function convertTZ(date: string | Date, tzString: string): Date {
    return new Date(
        (typeof date === 'string' ? new Date(date) : date).toLocaleString(
            'en-US',
            { timeZone: tzString }
        )
    )
}
