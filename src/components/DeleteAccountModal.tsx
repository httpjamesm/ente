import NoAccountsIcon from '@mui/icons-material/NoAccountsOutlined';
import TickIcon from '@mui/icons-material/Done';
import {
    Dialog,
    DialogContent,
    Typography,
    Button,
    Stack,
} from '@mui/material';
import { AppContext } from 'pages/_app';
import React, { useContext, useEffect, useState } from 'react';
import { preloadImage, initiateEmail } from 'utils/common';
import constants from 'utils/strings/constants';
import VerticallyCentered from './Container';
import DialogTitleWithCloseButton from './DialogBox/TitleWithCloseButton';
import { deleteAccount, getAccountDeleteChallenge } from 'services/userService';
import AuthenticateUserModal from './AuthenticateUserModal';
import { logError } from 'utils/sentry';
import { decryptDeleteAccountChallenge } from 'utils/crypto';
import { PAGES } from 'constants/pages';
import { useRouter } from 'next/router';

interface Iprops {
    onClose: () => void;
    open: boolean;
}
const DeleteAccountModal = ({ open, onClose }: Iprops) => {
    const { setDialogMessage, isMobile } = useContext(AppContext);
    const [authenticateUserModalView, setAuthenticateUserModalView] =
        useState(false);

    useEffect(() => {
        preloadImage('/images/delete-account');
    }, []);

    const openAuthenticateUserModal = () => setAuthenticateUserModalView(true);
    const closeAuthenticateUserModal = () =>
        setAuthenticateUserModalView(false);

    const sendFeedbackMail = () => initiateEmail('feedback@ente.io');
    const [deleteAccountChallenge, setDeleteAccountChallenge] = useState('');
    const router = useRouter();

    const initiateDelete = async () => {
        try {
            const deleteChallengeResponse = await getAccountDeleteChallenge();
            setDeleteAccountChallenge(
                deleteChallengeResponse.encryptedChallenge
            );
            if (deleteChallengeResponse.allowDelete) {
                confirmAccountDeletion();
            } else {
                askToMailForDeletion();
            }
        } catch (e) {
            logError(e, 'Error while initiating account deletion');
        }
    };

    const confirmAccountDeletion = () => {
        setDialogMessage({
            title: constants.CONFIRM_ACCOUNT_DELETION_TITLE,
            content: constants.CONFIRM_ACCOUNT_DELETION_MESSAGE,
            proceed: {
                text: constants.DELETE,
                action: openAuthenticateUserModal,
                variant: 'danger',
            },
            close: { text: constants.CANCEL },
        });
    };

    const askToMailForDeletion = () => {
        setDialogMessage({
            title: constants.DELETE_ACCOUNT,
            content: constants.DELETE_ACCOUNT_MESSAGE(),
            proceed: {
                text: constants.DELETE,
                action: () => {
                    initiateEmail('account-deletion@ente.io');
                },
                variant: 'danger',
            },
            close: { text: constants.CANCEL },
        });
    };

    const solveChallengeAndDeleteAccount = async () => {
        try {
            const decryptedChallenge = await decryptDeleteAccountChallenge(
                deleteAccountChallenge
            );
            await deleteAccount(decryptedChallenge);
            router.push(PAGES.ROOT);
        } catch (e) {
            logError(e, 'solveChallengeAndDeleteAccount failed');
        }
    };

    return (
        <>
            <Dialog
                fullWidth
                open={open}
                onClose={onClose}
                maxWidth="xs"
                fullScreen={isMobile}>
                <DialogTitleWithCloseButton onClose={onClose}>
                    <Typography variant="h3" fontWeight={'bold'}>
                        {constants.DELETE_ACCOUNT}
                    </Typography>
                </DialogTitleWithCloseButton>
                <DialogContent>
                    <VerticallyCentered>
                        <img
                            height={256}
                            src="/images/delete-account/1x.png"
                            srcSet="/images/delete-account/2x.png 2x,
                            /images/delete-account/3x.png 3x"
                        />
                    </VerticallyCentered>

                    <Typography color="text.secondary" px={1.5}>
                        {constants.ASK_FOR_FEEDBACK}
                    </Typography>

                    <Stack spacing={1} px={2} sx={{ width: '100%' }}>
                        <Button
                            size="large"
                            color="accent"
                            onClick={sendFeedbackMail}
                            startIcon={<TickIcon />}>
                            {constants.SEND_FEEDBACK}
                        </Button>
                        <Button
                            size="large"
                            variant="outlined"
                            color="danger"
                            onClick={initiateDelete}
                            startIcon={<NoAccountsIcon />}>
                            {constants.DELETE_ACCOUNT}
                        </Button>
                    </Stack>
                </DialogContent>
            </Dialog>
            <AuthenticateUserModal
                open={authenticateUserModalView}
                onClose={closeAuthenticateUserModal}
                onAuthenticate={solveChallengeAndDeleteAccount}
            />
        </>
    );
};

export default DeleteAccountModal;
