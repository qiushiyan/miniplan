# Critical Path Drag: Definition, Calculation, and Examples

## Introduction to Drag

Every project that is scheduled using the Critical Path Method is **exactly** as long as its longest path, its duration determined by the sum of that path's activities, lags and constraints. Therefore:

1.  That path is called the critical path.
2.  Any delays on that path make the project longer. By contrast, a delay on a shorter path will only make the project longer if it is so great as to make a different path the longest path. (The amount a non-critical activity can be delayed without switching critical paths is called its float or slack.)
3.  To shorten a project's duration, you have to shorten the current longest path. And if you get a new critical path, then you have to shorten it to compress the schedule further.

Critical path drag is the amount of time that a scheduled activity or lag is adding to the project's duration. Or, alternatively, it is the amount by which the project's duration would be shortened if the duration of any individual activity or lag were eliminated (i.e., reduced to zero).

Whereas float is always off the critical path, drag is only on the critical path. In other words, only items that are on the critical path delay the end of the project. When looking to compress a schedule, it's very helpful to know which items offer the most opportunity simply because they are adding the most time!

When using the Critical Path Method to schedule complex projects we can compute a quantity known as **drag**. Drag describes the impact that individual activities have on the overall project duration due to their durations. For instance, a critical activity with a duration of 3 months may have a drag value of (close to) 3 months.

This is often not a simple calculation. A critical path activity with a duration of 15 days may only have drag of 1 day—eliminate it entirely and the project would only be one day shorter! Elsewhere in the schedule, another activity with a duration of 6 days may have drag of 3 days. Find a way to reduce its duration by half, and the schedule will be compressed by 3 times as much!

When looking to shorten a schedule of thousands of activities, with a critical path of several hundred, schedulers need this critical information to point them to opportunities! Some software packages have been computing critical path drag for 15 or more years. But Primavera, the most popular software in the world for large projects, only computes float! Its CPM algorithm doesn't compute critical path drag, to tell the user which activities are adding how much time!

### How Drag is Calculated

The exact value of an activity's drag depends on the rest of the schedule. There are a few different cases:

1.  If the activity has positive total float, then it is not on any critical path. If we reduce its duration to zero, the project duration will not change. In this case, the drag value is zero.
2.  If the activity has no total float, then it is on at least one critical path.
    -   If it is not on all critical paths, then reducing its duration still does not change the project duration, since some other critical path will remain unchanged in length.
    -   If it is on all critical paths, then reducing its duration will reduce the project duration. However, it may be that setting its duration to 0 causes some other path to become critical. We can calculate whether this is the case by looking at the total float of _parallel_ activities (activities which are neither descendants, nor ancestors, of the activity we're calculating drag for). If some parallel activity exists with a total float of say, 3, then we know that the drag on this activity cannot exceed 3. We therefore can compute drag as the minimum of the activity's duration, and the minimum total float of any parallel activity.

To gain intuition for how drag is calculated, look at the example schedule in Figure 1 below. In the figure, a schedule and its duration are displayed. Below the schedule we see the list of activities, with a button for each activity that sets the activity's duration to 0, runs CPM, and computes the resulting duration. We then record those figures into the table, and therefore we can calculate the drag for each activity in this tiny example schedule.

Project duration w/ normal activity duration

Project duration w/ 0 activity duration

Click button to calculate

Click button to calculate

Click button to calculate

Click button to calculate

Click button to calculate

Click button to calculate

Click button to calculate

Click button to calculate

Figure 1: Our baseline schedule with four activities. The activities A, B, C, and D have durations of 3, 5, 2 and 4 days respectively. There are finish-start constraints between A → B as well as B → C, and a start-start constraint between B → C. The highlighted precedence relationships in the chart are active for the current schedule. The project start date is set to 2024-01-01. Activities can only be dragged to new start dates if there's no precedence relationship that would be violated by such a change.

## Why Drag Matters, and How to Use It

Drag is a powerful tool for project managers. It allows us to understand the impact of individual activities on the overall project duration. **By understanding drag, we can identify activities that, if sped up, can reduce the overall duration of the project.** The way we recommend using drag is as follows:

1.  Evaluate the drag values of the activities in your schedule
2.  Inspect the drag values you get, and identify any issues with the schedule that are causing the drag values to be unexpected. Concretely:
    -   An activity may have no drag because it is not critical (i.e. it has float)
    -   An activity may have no drag, even though it is critical, because some parallel activity exists which has no float
    -   An activity may have no (positive) drag, even though it is critical, because it is on a [reverse section of the critical path](#reverse-critical-paths)
    -   An activity may have a drag value of its duration (or less than its duration), depending on any parallel activities in the schedule
3.  Having evaluated and studied the drag values, you can now use them to look for ways to speed up your project. The drag value tells you how much shorter the project can become by reducing the duration of the activity, so you would then focus on ways to speed up exactly those activities with (highest) drag. This can be done by increasing resource limits, finding new technical ways to execute the activity and so forth.

## Special Case: Reverse Critical Paths

An issue can arise when computing drag values that has to do with reverse sections of critical paths:

Figure 2: A simple schedule which contains a reverse critical path through activity B. Due to the FF relationship between A and B, B becoming shorter makes the overall project completion date later!

Very counterintuitively, in such special cases reducing activity duration can increase the project duration. Such activities, therefore, will have a negative drag value.

## Special Case: Critical Paths with Multiple Calendars

Many project schedules use calendars to manage resource & activity timing. Calendars are used to indicate when work can make progress. For instance, certain work can only be done during certain times of day, certain crews have holiday periods etc. When the activities along the critical path don't share the same calendar, it can be tricky to understand how changes in activity duration impact the overall project duration.

For example, imagine a simple project focused on constructing earthworks. The first step is to put down a layer of sand, after which it must set for some period of time. The layering happens 9-5 Monday through Friday, but the setting of the sand happens 24/7.

What happens to the project duration if we are able to finish putting down the sand one day earlier? Does the project get shortened by a day? It depends on the original activity timing! If putting down sand was scheduled to start on Friday morning, take up the whole Friday, then proceed on the Monday and finish at 5PM (thus taking 2 working days of effort), and we sped up putting down sand by 1 working day, we would get a project that delivers 3 days early. Further, it depends on how we measure project duration. In this example, it delivers 3 days early—but that is not necessarily how many working days it gets shortened by.

In such special cases, drag values can be longer than the activity duration itself, and this is due to the issue with multiple calendars being used along the project's critical path!

#### Multiple calendar example

Baseline plan: we finish on Thursday 14 November 16:00

![schedule graph](/drag/drag-calendar-1.png)

What is the drag on "Lay sand"? If we set duration to zero:

-   We now finish on Monday 11 November 08:00. This is 4 working days earlier, but the duration of "Lay sand" was only 2 days.
-   The extra 2 days (the weekend) are "won" by getting the sand down before the weekend, and letting the setting process happen when other work can't be done.

![schedule with one activity duration set to 0](/drag/drag-calendar-2.png)

## Learn More
