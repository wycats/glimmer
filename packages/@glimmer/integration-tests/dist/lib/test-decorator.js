import { keys } from '@glimmer/util';
export function test(...args) {
    if (args.length === 1) {
        let meta = args[0];
        return (_target, _name, descriptor) => {
            let testFunction = descriptor.value;
            keys(meta).forEach(key => (testFunction[key] = meta[key]));
            setTestingDescriptor(descriptor);
        };
    }
    let descriptor = args[2];
    setTestingDescriptor(descriptor);
    return descriptor;
}
function setTestingDescriptor(descriptor) {
    let testFunction = descriptor.value;
    descriptor.enumerable = true;
    testFunction['isTest'] = true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC1kZWNvcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdGVzdC1kZWNvcmF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGVBQWUsQ0FBQztBQWdCckMsTUFBTSxVQUFVLElBQUksQ0FBQyxHQUFHLElBQVc7SUFDakMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUNyQixJQUFJLElBQUksR0FBc0IsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLE9BQU8sQ0FBQyxPQUFlLEVBQUUsS0FBYSxFQUFFLFVBQThCLEVBQUUsRUFBRTtZQUN4RSxJQUFJLFlBQVksR0FBRyxVQUFVLENBQUMsS0FBd0IsQ0FBQztZQUN2RCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRCxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuQyxDQUFDLENBQUM7S0FDSDtJQUVELElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN6QixvQkFBb0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqQyxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxVQUE4QjtJQUMxRCxJQUFJLFlBQVksR0FBRyxVQUFVLENBQUMsS0FBd0IsQ0FBQztJQUN2RCxVQUFVLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztJQUM3QixZQUFZLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQ2hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBrZXlzIH0gZnJvbSAnQGdsaW1tZXIvdXRpbCc7XG5pbXBvcnQgeyBEaWN0IH0gZnJvbSAnQGdsaW1tZXIvaW50ZXJmYWNlcyc7XG5cbmV4cG9ydCB0eXBlIERlY2xhcmVkQ29tcG9uZW50S2luZCA9ICdnbGltbWVyJyB8ICdjdXJseScgfCAnZHluYW1pYycgfCAnYmFzaWMnIHwgJ2ZyYWdtZW50JztcblxuZXhwb3J0IGludGVyZmFjZSBDb21wb25lbnRUZXN0TWV0YSB7XG4gIGtpbmQ/OiBEZWNsYXJlZENvbXBvbmVudEtpbmQ7XG4gIHNraXA/OiBib29sZWFuIHwgRGVjbGFyZWRDb21wb25lbnRLaW5kO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGVzdChtZXRhOiBDb21wb25lbnRUZXN0TWV0YSk6IE1ldGhvZERlY29yYXRvcjtcbmV4cG9ydCBmdW5jdGlvbiB0ZXN0KFxuICBfdGFyZ2V0OiBPYmplY3QgfCBDb21wb25lbnRUZXN0TWV0YSxcbiAgX25hbWU/OiBzdHJpbmcsXG4gIGRlc2NyaXB0b3I/OiBQcm9wZXJ0eURlc2NyaXB0b3Jcbik6IFByb3BlcnR5RGVzY3JpcHRvciB8IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gdGVzdCguLi5hcmdzOiBhbnlbXSkge1xuICBpZiAoYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICBsZXQgbWV0YTogQ29tcG9uZW50VGVzdE1ldGEgPSBhcmdzWzBdO1xuICAgIHJldHVybiAoX3RhcmdldDogT2JqZWN0LCBfbmFtZTogc3RyaW5nLCBkZXNjcmlwdG9yOiBQcm9wZXJ0eURlc2NyaXB0b3IpID0+IHtcbiAgICAgIGxldCB0ZXN0RnVuY3Rpb24gPSBkZXNjcmlwdG9yLnZhbHVlIGFzIEZ1bmN0aW9uICYgRGljdDtcbiAgICAgIGtleXMobWV0YSkuZm9yRWFjaChrZXkgPT4gKHRlc3RGdW5jdGlvbltrZXldID0gbWV0YVtrZXldKSk7XG4gICAgICBzZXRUZXN0aW5nRGVzY3JpcHRvcihkZXNjcmlwdG9yKTtcbiAgICB9O1xuICB9XG5cbiAgbGV0IGRlc2NyaXB0b3IgPSBhcmdzWzJdO1xuICBzZXRUZXN0aW5nRGVzY3JpcHRvcihkZXNjcmlwdG9yKTtcbiAgcmV0dXJuIGRlc2NyaXB0b3I7XG59XG5cbmZ1bmN0aW9uIHNldFRlc3RpbmdEZXNjcmlwdG9yKGRlc2NyaXB0b3I6IFByb3BlcnR5RGVzY3JpcHRvcik6IHZvaWQge1xuICBsZXQgdGVzdEZ1bmN0aW9uID0gZGVzY3JpcHRvci52YWx1ZSBhcyBGdW5jdGlvbiAmIERpY3Q7XG4gIGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IHRydWU7XG4gIHRlc3RGdW5jdGlvblsnaXNUZXN0J10gPSB0cnVlO1xufVxuIl19