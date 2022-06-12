import { PeriodToggler } from './periodToggler';
import { ManageSubscription } from './manageSubscription';
import React, { useContext, useEffect, useState } from 'react';
import constants from 'utils/strings/constants';
import { Plan, Subscription } from 'types/billing';
import {
    getUserSubscription,
    isUserSubscribedPlan,
    isSubscriptionCancelled,
    updateSubscription,
    hasStripeSubscription,
    hasPaidSubscription,
    isOnFreePlan,
    planForSubscription,
    hasMobileSubscription,
    hasPaypalSubscription,
} from 'utils/billing';
import { reverseString } from 'utils/common';
import { GalleryContext } from 'pages/gallery';
import billingService from 'services/billingService';
import { SetLoading } from 'types/gallery';
import { logError } from 'utils/sentry';
import { AppContext } from 'pages/_app';
import DialogBox from 'components/DialogBox';
import Plans from './plans';
import { DialogBoxAttributes } from 'types/dialogBox';

interface Props {
    modalView: boolean;
    closeModal: any;

    setLoading: SetLoading;
}
export enum PLAN_PERIOD {
    MONTH = 'month',
    YEAR = 'year',
}
function PlanSelector(props: Props) {
    const subscription: Subscription = getUserSubscription();
    const [plans, setPlans] = useState<Plan[]>(null);
    const [planPeriod, setPlanPeriod] = useState<PLAN_PERIOD>(PLAN_PERIOD.YEAR);
    const galleryContext = useContext(GalleryContext);
    const appContext = useContext(AppContext);

    const togglePeriod = () => {
        setPlanPeriod((prevPeriod) =>
            prevPeriod === PLAN_PERIOD.MONTH
                ? PLAN_PERIOD.YEAR
                : PLAN_PERIOD.MONTH
        );
    };
    function onReopenClick() {
        appContext.closeMessageDialog();
        galleryContext.showPlanSelectorModal();
    }
    useEffect(() => {
        if (!props.modalView) {
            return;
        }
        const main = async () => {
            try {
                props.setLoading(true);
                let plans = await billingService.getPlans();

                const planNotListed =
                    plans.filter((plan) =>
                        isUserSubscribedPlan(plan, subscription)
                    ).length === 0;
                if (
                    subscription &&
                    !isOnFreePlan(subscription) &&
                    planNotListed
                ) {
                    plans = [planForSubscription(subscription), ...plans];
                }
                setPlans(plans);
            } catch (e) {
                logError(e, 'plan selector modal open failed');
                props.closeModal();
                appContext.setDialogMessage({
                    title: constants.OPEN_PLAN_SELECTOR_MODAL_FAILED,
                    content: constants.UNKNOWN_ERROR,
                    close: { text: 'close', variant: 'danger' },
                    proceed: {
                        text: constants.REOPEN_PLAN_SELECTOR_MODAL,
                        variant: 'success',
                        action: onReopenClick,
                    },
                });
            } finally {
                props.setLoading(false);
            }
        };
        main();
    }, [props.modalView]);

    async function onPlanSelect(plan: Plan) {
        if (
            hasMobileSubscription(subscription) &&
            !isSubscriptionCancelled(subscription)
        ) {
            appContext.setDialogMessage({
                title: constants.ERROR,
                content: constants.CANCEL_SUBSCRIPTION_ON_MOBILE,
                close: { variant: 'danger' },
            });
        } else if (
            hasPaypalSubscription(subscription) &&
            !isSubscriptionCancelled(subscription)
        ) {
            appContext.setDialogMessage({
                title: constants.MANAGE_PLAN,
                content: constants.PAYPAL_MANAGE_NOT_SUPPORTED_MESSAGE(),
                close: { variant: 'danger' },
            });
        } else if (hasStripeSubscription(subscription)) {
            appContext.setDialogMessage({
                title: `${constants.CONFIRM} ${reverseString(
                    constants.UPDATE_SUBSCRIPTION
                )}`,
                content: constants.UPDATE_SUBSCRIPTION_MESSAGE,
                proceed: {
                    text: constants.UPDATE_SUBSCRIPTION,
                    action: updateSubscription.bind(
                        null,
                        plan,
                        appContext.setDialogMessage,
                        props.setLoading,
                        props.closeModal
                    ),
                    variant: 'success',
                },
                close: { text: constants.CANCEL },
            });
        } else {
            try {
                props.setLoading(true);
                await billingService.buySubscription(plan.stripeID);
            } catch (e) {
                props.setLoading(false);
                appContext.setDialogMessage({
                    title: constants.ERROR,
                    content: constants.SUBSCRIPTION_PURCHASE_FAILED,
                    close: { variant: 'danger' },
                });
            }
        }
    }

    const planSelectorAttributes: DialogBoxAttributes = {
        staticBackdrop: !hasPaidSubscription(subscription),
        title: hasPaidSubscription(subscription)
            ? constants.MANAGE_PLAN
            : constants.CHOOSE_PLAN,
    };

    return (
        <DialogBox
            open={props.modalView}
            titleCloseButton
            onClose={props.closeModal}
            size={'xl'}
            attributes={planSelectorAttributes}
            fullWidth={false}>
            <PeriodToggler
                planPeriod={planPeriod}
                togglePeriod={togglePeriod}
            />
            <Plans
                plans={plans}
                planPeriod={planPeriod}
                onPlanSelect={onPlanSelect}
                subscription={subscription}
            />
            <ManageSubscription
                subscription={subscription}
                closeModal={props.closeModal}
                setLoading={props.setLoading}
            />
        </DialogBox>
    );
}

export default PlanSelector;
